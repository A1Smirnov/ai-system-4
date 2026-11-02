"""Install only named user units/launchers; never enable login/boot autostart."""
from pathlib import Path
import datetime
import json
import os
import shutil
import subprocess

root = Path(__file__).resolve().parent.parent
home = Path.home().resolve()
node = Path(shutil.which('node')).resolve()
if not node.is_file() or not os.access(node, os.X_OK):
    raise SystemExit('An executable native Node is required')
unit_dir = home / '.config/systemd/user'
app_dir = home / '.local/share/applications'
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
backup_dir = root / 'state/local-backups' / ('systemd-install-' + stamp)
backup_dir.mkdir(mode=0o700, parents=True)
written = []


def write(destination, text, executable=False):
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.is_symlink():
        raise RuntimeError('Refusing to replace symlink: ' + str(destination))
    if destination.exists():
        shutil.copy2(destination, backup_dir / (str(len(written)) + '-' + destination.name))
    temporary = destination.with_name(destination.name + '.ai-system.tmp')
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o755 if executable else 0o644)
    with os.fdopen(fd, 'w') as file:
        file.write(text)
        file.flush()
        os.fsync(file.fileno())
    os.replace(temporary, destination)
    written.append(str(destination))


for name in ['ai-system.target', 'ai-system-gateway.service', 'ai-system-dashboard.service']:
    text = (root / 'scripts/systemd' / (name + '.in')).read_text()
    text = text.replace('@ROOT@', str(root)).replace('@NODE_BIN@', str(node.parent))
    write(unit_dir / name, text)
subprocess.run(['systemd-analyze', '--user', 'verify', *[str(unit_dir / n) for n in
                ['ai-system.target', 'ai-system-gateway.service', 'ai-system-dashboard.service']]], check=True)
for action, name, icon in [('start', 'Run AI-System', 'system-run'), ('stop', 'Stop AI-System', 'process-stop')]:
    launch = ('Exec=' + str(root / 'scripts/run-ai-system-terminal.sh') + '\nTerminal=true\n'
              if action == 'start' else
              'Exec=' + str(root / 'scripts/ai-system.sh') + ' stop --notify\nTerminal=false\n')
    text = ('[Desktop Entry]\nType=Application\nName=' + name + '\n'
            'Comment=Manual OpenClaw chats and read-only Headhunter dashboard\n'
            + launch + 'Icon=' + icon + '\nStartupNotify=false\nCategories=Utility;\n')
    write(app_dir / ('ai-system-' + action + '.desktop'), text)
    desktop = home / 'Desktop'
    if desktop.is_dir():
        write(desktop / (name + '.desktop'), text, executable=True)
subprocess.run(['systemctl', '--user', 'daemon-reload'], check=True)
if shutil.which('update-desktop-database'):
    subprocess.run(['update-desktop-database', str(app_dir)], check=True)
manifest = {'installed_at': stamp, 'files': written, 'node': str(node), 'autostart_enabled': False}
(backup_dir / 'installation.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps(manifest))
