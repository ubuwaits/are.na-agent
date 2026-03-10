export type ChannelVisibility = "public" | "private" | "closed";
export type ConnectableType = "Block" | "Channel";
export type ExecutionMode = "auto" | "single" | "batch";
export type ManifestMode = "create" | "extend";
export type SearchSort =
  | "score_desc"
  | "created_at_desc"
  | "created_at_asc"
  | "updated_at_desc"
  | "updated_at_asc"
  | "title_asc"
  | "title_desc"
  | "random";

export interface MarkdownContent {
  markdown: string;
  html?: string;
  plain?: string;
}

export interface ArenaProvider {
  name: string;
  url: string;
}

export interface ArenaSource {
  url: string;
  title?: string | null;
  provider?: ArenaProvider | null;
}

export interface ArenaBlockAttachment {
  filename?: string | null;
  content_type?: string | null;
  file_size?: number | null;
  file_extension?: string | null;
  updated_at?: string | null;
  url: string;
}

export interface ArenaImageVersion {
  url: string;
}

export interface ArenaBlockImage {
  alt_text?: string | null;
  blurhash?: string | null;
  width?: number | null;
  height?: number | null;
  src?: string | null;
  aspect_ratio?: number | null;
  content_type?: string;
  filename?: string;
  file_size?: number | null;
  updated_at?: string;
  small?: ArenaImageVersion;
  medium?: ArenaImageVersion;
  large?: ArenaImageVersion;
  square?: ArenaImageVersion;
}

export interface ArenaBlockEmbed {
  url?: string | null;
  type?: string | null;
  title?: string | null;
  author_name?: string | null;
  author_url?: string | null;
  source_url?: string | null;
  width?: number | null;
  height?: number | null;
  html?: string | null;
  thumbnail_url?: string | null;
}

export interface ArenaUser {
  id: number;
  type: "User";
  name: string;
  slug: string;
  avatar?: string | null;
  initials?: string;
}

export interface ArenaGroup {
  id: number;
  type: "Group";
  title?: string;
  slug?: string;
}

export interface ChannelAbilities {
  add_to: boolean;
  update: boolean;
  destroy: boolean;
  manage_collaborators: boolean;
}

export interface EmbeddedConnection {
  id?: number;
  position?: number | null;
}

export interface ArenaChannel {
  id: number;
  type: "Channel";
  slug: string;
  title: string;
  description?: MarkdownContent | null;
  visibility: ChannelVisibility;
  owner: ArenaUser | ArenaGroup;
  counts?: Record<string, number>;
  can?: ChannelAbilities | null;
  connection?: EmbeddedConnection | null;
}

export interface ArenaBlock {
  id: number;
  base_type: "Block";
  type: "Text" | "Image" | "Link" | "Attachment" | "Embed" | "PendingBlock";
  title?: string | null;
  description?: MarkdownContent | null;
  state?: string;
  visibility?: string;
  comment_count?: number;
  created_at?: string;
  updated_at?: string;
  user?: ArenaUser;
  source?: ArenaSource | null;
  connection?: EmbeddedConnection | null;
  can?: Record<string, boolean> | null;
  content?: MarkdownContent | null;
  image?: ArenaBlockImage | null;
  attachment?: ArenaBlockAttachment | null;
  embed?: ArenaBlockEmbed | null;
}

export type ArenaConnectable = ArenaBlock | ArenaChannel;

export interface PaginationMeta {
  current_page: number;
  next_page?: number | null;
  prev_page?: number | null;
  per_page: number;
  total_pages: number;
  total_count: number;
  has_more_pages: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface SearchParams {
  query?: string;
  type?: string[];
  scope?: string;
  user_id?: number;
  group_id?: number;
  channel_id?: number;
  ext?: string[];
  sort?: SearchSort;
  after?: string;
  seed?: number;
  page?: number;
  per?: number;
}

export interface CreateChannelInput {
  title: string;
  visibility?: ChannelVisibility;
  description?: string;
  group_id?: number;
}

export interface UpdateChannelInput {
  title?: string;
  visibility?: ChannelVisibility;
  description?: string | null;
}

export interface BlockInput {
  value: string;
  title?: string;
  description?: string;
  original_source_url?: string;
  original_source_title?: string;
  alt_text?: string;
}

export interface CreateBlockInput extends BlockInput {
  channel_ids: Array<number | string>;
  insert_at?: number;
}

export interface BatchCreateBlocksInput {
  channel_ids: Array<number | string>;
  blocks: BlockInput[];
}

export interface BatchAcceptedResponse {
  batch_id: string;
  status: "pending";
  total: number;
}

export interface BatchItemSuccess {
  index: number;
  block_id: number;
}

export interface BatchItemFailure {
  index: number;
  error: string;
}

export interface BatchStatusResponse {
  batch_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  total: number;
  successful_count: number;
  failed_count: number;
  successful?: BatchItemSuccess[];
  failed?: BatchItemFailure[];
  created_at?: string;
  completed_at?: string;
  error?: string;
}

export interface CreateConnectionInput {
  connectable_id: number | string;
  connectable_type: ConnectableType;
  channel_ids: Array<number | string>;
  position?: number;
}

export interface ArenaConnection {
  id?: number;
  position?: number | null;
  can?: Record<string, boolean>;
}

export interface PresignFileRequest {
  filename: string;
  content_type: string;
}

export interface PresignedFile {
  upload_url: string;
  key: string;
  content_type: string;
}

export interface PresignResponse {
  files: PresignedFile[];
  expires_in: number;
}

export interface SourceContext {
  web_queries?: string[];
  arena_queries?: string[];
  notes?: string[];
}

export interface BaseCandidate {
  title?: string;
  description?: string;
  original_source_url?: string;
  original_source_title?: string;
  alt_text?: string;
  source_identity?: string;
  source_provider?: string;
}

export interface CuratedTextCandidate extends BaseCandidate {
  kind: "text";
  value: string;
}

export interface CuratedUrlCandidate extends BaseCandidate {
  kind: "url";
  url: string;
}

export interface CuratedUploadCandidate extends BaseCandidate {
  kind: "upload";
  path: string;
  content_type?: string;
}

export interface CuratedExistingCandidate extends BaseCandidate {
  kind: "existing";
  connectable_id: number | string;
  connectable_type: ConnectableType;
}

export type CuratedCandidate =
  | CuratedTextCandidate
  | CuratedUrlCandidate
  | CuratedUploadCandidate
  | CuratedExistingCandidate;

export interface ChannelCurationManifest {
  mode: ManifestMode;
  theme: string;
  channel?: CreateChannelInput;
  target_channel?: number | string;
  items: CuratedCandidate[];
  source_context?: SourceContext;
  execution_mode?: ExecutionMode;
}

export interface ArenaEnv {
  accessToken: string;
  apiBaseUrl: string;
  batchPollIntervalMs: number;
  batchPollTimeoutMs: number;
  writeDelayMs: number;
}

export interface UploadResult {
  path: string;
  filename: string;
  contentType: string;
  key: string;
  storageUrl: string;
  bytes: number;
}

export interface ApplyManifestOptions {
  dryRun?: boolean;
}

export interface ApplyResultItem {
  index: number;
  kind: CuratedCandidate["kind"];
  id?: number;
  connectable_type?: ConnectableType;
  title?: string;
  url?: string;
  status: "created" | "connected" | "skipped" | "failed";
  reason?: string;
}

export interface ApplyManifestResult {
  mode: ManifestMode;
  theme: string;
  target_channel?: ArenaChannel;
  created_channel?: ArenaChannel;
  execution_mode: ExecutionMode;
  dry_run: boolean;
  attempted_items: number;
  deduped_items: number;
  skipped_duplicates: ApplyResultItem[];
  applied_items: ApplyResultItem[];
  failures: ApplyResultItem[];
  batch?: BatchStatusResponse;
}

export interface PreparedBlockOperation {
  type: "create-block";
  index: number;
  candidate: CuratedCandidate;
  input: BlockInput;
}

export interface PreparedConnectionOperation {
  type: "connect-existing";
  index: number;
  candidate: CuratedExistingCandidate;
  input: CreateConnectionInput;
}

export type PreparedOperation = PreparedBlockOperation | PreparedConnectionOperation;
