/** Contracts reflect persisted data and execution boundaries; they grant no authority. */
export type RoleId = 'main-1'|'mail-1'|'backup-1'|'security-1'|'headhunter-1'|'webdev-1'|'elder-1'|'security-web-1'|'analytics-1'|'clients-1';
export type TaskStatus = 'queued'|'running'|'completed'|'partial'|'error'|'awaiting_access'|'awaiting_data'|'awaiting_decision'|'unverified';
export type Operation = 'coordinate'|'develop'|'analyze'|'draft'|'review'|'classify'|'extract'|'summarize_preliminary'|'check'|'collect'|'calculate';
export interface Source { type:'owner'|'external'|'system'|'test'; ref:string; }
export interface CandidateEvidence { id:string; text:string; source?:string|{path:string}; verification?:string; }
/** Parsed tasks.body / task creation input. Columns and JSON are distinct contracts. */
export interface TaskContract { owner:RoleId; domain:string; objective:string; operation:Operation; allowed_actions:string[]; sources:Source[]; acceptance_criteria:string; timeout_seconds:number; idempotency_key:string; deadline?:string|null; max_attempts?:1; }
/** Actual SQLite tasks row, before parsing body. */
export interface Task { id:string; idempotency_key:string; owner:RoleId; domain:string; objective:string; status:TaskStatus; body:string; created_at:string; updated_at:string; }
export interface TaskResult { task_id:string; summary:string; status:Exclude<TaskStatus,'queued'|'running'|'completed'>; claimed_status:TaskStatus; verified:false; evidence_refs:string[]; actions_taken:string[]; unknowns:string[]; next_action:string; needs_owner:boolean; }
export type ATSProvider = 'greenhouse'|'lever'|'ashby';
export interface JobOpportunity { provider:ATSProvider; source_id:string; source_job_id:string; employer:string; title:string; location:string; description:string; description_truncated?:boolean; url:string; provenance:'untrusted-external'; fit_verified:false; }
export interface ApplicationPackage { version:1; job_key:string; source_hash:string; profile_version:string; provider:ATSProvider; destination:string; resume:{id:string;sha256:string}; answers:Record<string,string>; cover_letter:string; created_at:string; }
export interface ApprovalRequest { id:string; digest:string; }
export interface ApprovalGrant { id:string; packet:string; digest:string; expires_at:string; revoked:0|1; created_at:string; }
export type ExecutionAttempt = {state:'opening';submit_clicks:0}|{state:'needs_owner'|'unknown'|'validation_error';submit_clicks:number;automatic_retry_allowed?:false}|{state:'submitted';submit_clicks:number;confirmation_url:string;confirmation_text:string};
export interface AgentCapability { name:string; description:string; inputSchema:ToolSchema; }
/** roles.json entry; native main ID differs from the application role main-1. */
export interface Agent { name:RoleId; agentId:string; purpose:string; mode:string; required_sources:string[]; interactive_model?:string; interactive_thinking?:string; }
/** Native agent.tools entry, separate from task allowed_actions and exact grants. */
export interface PermissionPolicy { profile:string; deny?:string[]; alsoAllow?:string[]; }
export interface AuditEvent { role:RoleId; tool:string; outcome:'started'|'returned'|'denied'|'failed'; permission_check:'role-and-input-schema'; }
export interface ErrorResult { isError:true; content:{type:'text';text:string}[]; }
export interface ToolSchema { type:string|string[]; properties?:Record<string,ToolSchema>; required?:string[]; additionalProperties?:boolean; items?:ToolSchema; enum?:unknown[]; minLength?:number; maxLength?:number; minimum?:number; maximum?:number; minItems?:number; maxItems?:number; uniqueItems?:boolean; }
