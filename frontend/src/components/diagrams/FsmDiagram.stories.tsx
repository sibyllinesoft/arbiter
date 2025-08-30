import type { Meta, StoryObj } from '@storybook/react';
import { SplitViewShowcase } from './SplitViewShowcase';
import { DataViewer } from './DataViewer';
import { MermaidRenderer } from './MermaidRenderer';

const meta = {
  title: 'Diagrams/State Machine Diagrams - Split View',
  component: SplitViewShowcase,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SplitViewShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// REALISTIC STATE MACHINE EXAMPLES
// ============================================================================

const orderStateMachineYaml = `# Order Processing State Machine
name: "E-commerce Order Processing"
version: "1.3.0"

# Initial State
initial_state: "cart"

# State Definitions
states:
  cart:
    type: "compound"
    description: "Shopping cart management"
    entry_actions: ["initialize_cart", "load_saved_items"]
    exit_actions: ["validate_cart_items"]
    
  checkout:
    type: "compound"
    description: "Checkout process with payment"
    entry_actions: ["calculate_totals", "apply_discounts"]
    
  payment_processing:
    type: "atomic"
    description: "Payment gateway processing"
    timeout: "30s"
    entry_actions: ["create_payment_intent"]
    
  order_confirmed:
    type: "atomic"
    description: "Order successfully placed"
    entry_actions: ["send_confirmation", "inventory_reserve"]
    
  fulfillment:
    type: "compound"
    description: "Order fulfillment process"
    substates:
      - "preparing"
      - "picking"
      - "packing"
      - "shipping"
    
  delivered:
    type: "final"
    description: "Order completed successfully"
    entry_actions: ["release_inventory", "send_receipt"]
    
  cancelled:
    type: "final" 
    description: "Order cancelled by user or system"
    entry_actions: ["refund_payment", "restore_inventory"]
    
  failed:
    type: "final"
    description: "Order processing failed"
    entry_actions: ["log_error", "notify_support"]

# Transition Rules
transitions:
  - from: "cart"
    to: "checkout"
    event: "PROCEED_TO_CHECKOUT"
    guard: "cart_not_empty && user_authenticated"
    
  - from: "checkout"
    to: "payment_processing"
    event: "SUBMIT_PAYMENT"
    guard: "payment_method_valid && address_valid"
    
  - from: "checkout"
    to: "cart"
    event: "BACK_TO_CART"
    
  - from: "payment_processing"
    to: "order_confirmed"
    event: "PAYMENT_SUCCESS"
    actions: ["create_order_record"]
    
  - from: "payment_processing"
    to: "failed"
    event: "PAYMENT_FAILED"
    guard: "retry_attempts >= 3"
    
  - from: "payment_processing"
    to: "checkout"
    event: "PAYMENT_FAILED"
    guard: "retry_attempts < 3"
    actions: ["increment_retry_count"]
    
  - from: "order_confirmed"
    to: "fulfillment"
    event: "BEGIN_FULFILLMENT"
    delay: "1h"
    
  - from: "fulfillment"
    to: "delivered"
    event: "DELIVERY_CONFIRMED"
    guard: "signature_received || contactless_delivery"
    
  - from: "cart"
    to: "cancelled"
    event: "ABANDON_CART"
    guard: "idle_time > 24h"
    
  - from: "checkout"
    to: "cancelled"
    event: "CANCEL_ORDER"
    
  - from: "order_confirmed"
    to: "cancelled"
    event: "CUSTOMER_CANCELLATION"
    guard: "within_cancellation_window"

# Event Definitions
events:
  PROCEED_TO_CHECKOUT:
    description: "User initiates checkout"
    payload: ["cart_id", "user_id"]
    
  SUBMIT_PAYMENT:
    description: "Payment information submitted"
    payload: ["payment_method", "billing_address"]
    
  PAYMENT_SUCCESS:
    description: "Payment processed successfully"
    payload: ["transaction_id", "amount"]
    
  PAYMENT_FAILED:
    description: "Payment processing failed"
    payload: ["error_code", "error_message"]
    
  DELIVERY_CONFIRMED:
    description: "Package delivered successfully"
    payload: ["delivery_time", "recipient"]

# Business Rules
business_rules:
  inventory_check:
    description: "Verify item availability before payment"
    applies_to: ["checkout"]
    
  fraud_detection:
    description: "Check for suspicious activity"
    applies_to: ["payment_processing"]
    
  cancellation_policy:
    description: "Allow cancellation within 2 hours of confirmation"
    window: "2h"
    applies_to: ["order_confirmed"]`;

const orderStateMermaid = `stateDiagram-v2
    [*] --> Cart
    
    Cart --> Checkout : PROCEED_TO_CHECKOUT
    Cart --> Cancelled : ABANDON_CART (24h timeout)
    
    Checkout --> Cart : BACK_TO_CART
    Checkout --> PaymentProcessing : SUBMIT_PAYMENT
    Checkout --> Cancelled : CANCEL_ORDER
    
    PaymentProcessing --> OrderConfirmed : PAYMENT_SUCCESS
    PaymentProcessing --> Checkout : PAYMENT_FAILED (retry < 3)
    PaymentProcessing --> Failed : PAYMENT_FAILED (retry >= 3)
    
    OrderConfirmed --> Fulfillment : BEGIN_FULFILLMENT (1h delay)
    OrderConfirmed --> Cancelled : CUSTOMER_CANCELLATION (within 2h)
    
    state Fulfillment {
        [*] --> Preparing
        Preparing --> Picking : items_prepared
        Picking --> Packing : items_picked  
        Packing --> Shipping : package_ready
        Shipping --> [*] : shipped
    }
    
    Fulfillment --> Delivered : DELIVERY_CONFIRMED
    
    Delivered --> [*]
    Cancelled --> [*]
    Failed --> [*]
    
    note right of PaymentProcessing
        Timeout: 30s
        Fraud detection active
    end note
    
    note right of OrderConfirmed
        Inventory reserved
        Confirmation email sent
    end note
    
    note right of Fulfillment
        Warehouse automation
        Real-time tracking
    end note`;

const userSessionMachineYaml = `# User Session State Machine
name: "User Session Management"
version: "2.0.0"

initial_state: "anonymous"

# State Configuration
states:
  anonymous:
    type: "initial"
    description: "Unauthenticated user state"
    allowed_actions: ["browse_products", "view_content"]
    restrictions: ["checkout", "profile_access"]
    
  authenticating:
    type: "transient"
    description: "Login process in progress"
    timeout: "60s"
    entry_actions: ["show_spinner", "validate_credentials"]
    
  authenticated:
    type: "compound"
    description: "Logged in user"
    entry_actions: ["load_profile", "restore_cart", "log_session_start"]
    exit_actions: ["save_session_state"]
    substates:
      - "active"
      - "idle_warning"
      - "session_extending"
      
  mfa_required:
    type: "atomic"
    description: "Multi-factor authentication required"
    timeout: "300s"
    entry_actions: ["send_mfa_code", "start_mfa_timer"]
    
  session_expired:
    type: "atomic"
    description: "Session has expired"
    entry_actions: ["clear_session", "show_expired_message"]
    
  locked_out:
    type: "atomic"
    description: "Account locked due to security"
    timeout: "900s"
    entry_actions: ["send_security_alert", "log_lockout"]
    
  logged_out:
    type: "final"
    description: "User logged out successfully"
    entry_actions: ["clear_session", "redirect_home"]

# Session Transitions
transitions:
  - from: "anonymous"
    to: "authenticating"
    event: "LOGIN_ATTEMPT"
    
  - from: "authenticating" 
    to: "mfa_required"
    event: "CREDENTIALS_VALID"
    guard: "mfa_enabled"
    
  - from: "authenticating"
    to: "authenticated"
    event: "CREDENTIALS_VALID"
    guard: "!mfa_enabled"
    
  - from: "authenticating"
    to: "locked_out"
    event: "CREDENTIALS_INVALID"
    guard: "failed_attempts >= 5"
    
  - from: "authenticating"
    to: "anonymous"
    event: "CREDENTIALS_INVALID"
    guard: "failed_attempts < 5"
    actions: ["increment_failed_attempts"]
    
  - from: "mfa_required"
    to: "authenticated"
    event: "MFA_SUCCESS"
    actions: ["reset_failed_attempts"]
    
  - from: "mfa_required"
    to: "anonymous"
    event: "MFA_FAILED"
    actions: ["increment_mfa_failures"]
    
  - from: "mfa_required"
    to: "locked_out"
    event: "MFA_TIMEOUT"
    
  - from: "authenticated"
    to: "session_expired"
    event: "SESSION_TIMEOUT"
    
  - from: "authenticated"
    to: "logged_out"
    event: "LOGOUT"
    
  - from: "session_expired"
    to: "anonymous"
    event: "ACKNOWLEDGE"
    
  - from: "locked_out"
    to: "anonymous"
    event: "LOCKOUT_EXPIRED"

# Compound State Details
compound_states:
  authenticated:
    initial_substate: "active"
    
    active:
      description: "User actively using the application"
      activity_timeout: "30m"
      
    idle_warning:
      description: "Warning user about upcoming timeout"
      warning_duration: "2m"
      
    session_extending:
      description: "User chose to extend session"
      extension_duration: "30m"

# Security Policies
security_policies:
  session_duration:
    default: "8h"
    extended: "24h"
    remember_me: "30d"
    
  lockout_policy:
    failed_attempts: 5
    lockout_duration: "15m"
    progressive_delay: true
    
  mfa_policy:
    code_expiry: "5m"
    backup_codes: 10
    remember_device: "30d"`;

const userSessionMermaid = `stateDiagram-v2
    [*] --> Anonymous
    
    Anonymous --> Authenticating : LOGIN_ATTEMPT
    
    Authenticating --> MFARequired : CREDENTIALS_VALID (MFA enabled)
    Authenticating --> Authenticated : CREDENTIALS_VALID (no MFA)
    Authenticating --> LockedOut : CREDENTIALS_INVALID (attempts >= 5)
    Authenticating --> Anonymous : CREDENTIALS_INVALID (retry)
    
    MFARequired --> Authenticated : MFA_SUCCESS
    MFARequired --> Anonymous : MFA_FAILED
    MFARequired --> LockedOut : MFA_TIMEOUT (5m)
    
    state Authenticated {
        [*] --> Active
        Active --> IdleWarning : IDLE_TIMEOUT (30m)
        IdleWarning --> Active : USER_ACTIVITY
        IdleWarning --> SessionExtending : EXTEND_SESSION
        IdleWarning --> [*] : WARNING_TIMEOUT (2m)
        SessionExtending --> Active : EXTENSION_CONFIRMED
    }
    
    Authenticated --> SessionExpired : SESSION_TIMEOUT
    Authenticated --> LoggedOut : LOGOUT
    
    SessionExpired --> Anonymous : ACKNOWLEDGE
    LockedOut --> Anonymous : LOCKOUT_EXPIRED (15m)
    LoggedOut --> [*]
    
    note right of Authenticating
        Rate limiting active
        Credential validation
        Failed attempt tracking
    end note
    
    note right of MFARequired
        SMS/TOTP verification
        5 minute timeout
        3 retry attempts max
    end note
    
    note right of Authenticated
        Activity monitoring
        Auto-save session state
        Privilege validation
    end note`;

const workflowApprovalYaml = `# Workflow Approval State Machine
name: "Document Approval Workflow"
version: "1.1.0"

initial_state: "draft"

# Workflow States
states:
  draft:
    type: "initial"
    description: "Document being authored"
    allowed_users: ["author", "collaborators"]
    actions: ["edit", "save", "add_comments"]
    
  review_requested:
    type: "atomic"
    description: "Review requested from stakeholders"
    entry_actions: ["notify_reviewers", "set_deadline"]
    allowed_users: ["reviewers", "author"]
    
  under_review:
    type: "compound"
    description: "Document under active review"
    substates: ["awaiting_feedback", "revision_requested", "approved_by_reviewer"]
    
  pending_approval:
    type: "atomic"
    description: "Awaiting final approval"
    entry_actions: ["notify_approvers", "generate_summary"]
    timeout: "5d"
    
  approved:
    type: "final"
    description: "Document approved and published"
    entry_actions: ["publish_document", "notify_stakeholders", "archive_comments"]
    
  rejected:
    type: "final"
    description: "Document rejected"
    entry_actions: ["send_rejection_notice", "log_rejection_reason"]
    
  withdrawn:
    type: "final"
    description: "Document withdrawn by author"
    entry_actions: ["log_withdrawal", "notify_reviewers"]

# Workflow Transitions
transitions:
  - from: "draft"
    to: "review_requested"
    event: "SUBMIT_FOR_REVIEW"
    guard: "document_complete && author_confirmed"
    actions: ["lock_document", "create_review_task"]
    
  - from: "review_requested"
    to: "under_review"
    event: "REVIEW_ACCEPTED"
    guard: "reviewer_assigned"
    
  - from: "review_requested"
    to: "draft"
    event: "REVIEW_DECLINED"
    actions: ["unlock_document", "notify_author"]
    
  - from: "under_review"
    to: "draft"
    event: "REVISION_REQUIRED"
    guard: "major_changes_needed"
    actions: ["unlock_document", "compile_feedback"]
    
  - from: "under_review"
    to: "pending_approval"
    event: "REVIEW_COMPLETE"
    guard: "all_reviewers_approved"
    
  - from: "pending_approval"
    to: "approved"
    event: "FINAL_APPROVAL"
    guard: "approver_authorized"
    
  - from: "pending_approval"
    to: "under_review"
    event: "APPROVAL_DECLINED"
    actions: ["request_additional_review"]
    
  - from: "pending_approval"
    to: "rejected"
    event: "FINAL_REJECTION"
    guard: "rejection_justified"
    
  # Withdrawal transitions
  - from: "draft"
    to: "withdrawn"
    event: "WITHDRAW_DOCUMENT"
    guard: "author_request"
    
  - from: "review_requested"
    to: "withdrawn"
    event: "WITHDRAW_DOCUMENT"
    guard: "author_request"
    
  - from: "under_review"
    to: "withdrawn"
    event: "WITHDRAW_DOCUMENT"
    guard: "author_request && no_approvals_pending"

# Role Definitions
roles:
  author:
    permissions: ["edit", "submit", "withdraw", "respond_to_comments"]
    
  reviewer:
    permissions: ["comment", "suggest_changes", "approve_section", "request_revision"]
    
  approver:
    permissions: ["final_approval", "final_rejection", "reassign_reviewer"]
    
  administrator:
    permissions: ["override_approval", "modify_workflow", "reassign_roles"]

# Business Rules
business_rules:
  review_deadline:
    description: "Reviews must be completed within timeframe"
    default_duration: "3d"
    escalation_after: "5d"
    
  approval_authority:
    description: "Different approval levels based on document type"
    levels:
      - type: "policy"
        required_approvers: 2
        roles: ["senior_manager", "legal"]
        
      - type: "procedure"
        required_approvers: 1
        roles: ["department_head"]
        
      - type: "guideline"
        required_approvers: 1
        roles: ["team_lead"]`;

const workflowApprovalMermaid = `stateDiagram-v2
    [*] --> Draft
    
    Draft --> ReviewRequested : SUBMIT_FOR_REVIEW
    Draft --> Withdrawn : WITHDRAW_DOCUMENT
    
    ReviewRequested --> UnderReview : REVIEW_ACCEPTED
    ReviewRequested --> Draft : REVIEW_DECLINED
    ReviewRequested --> Withdrawn : WITHDRAW_DOCUMENT
    
    state UnderReview {
        [*] --> AwaitingFeedback
        AwaitingFeedback --> RevisionRequested : issues_found
        AwaitingFeedback --> ApprovedByReviewer : review_positive
        RevisionRequested --> [*] : REVISION_REQUIRED
        ApprovedByReviewer --> [*] : REVIEW_COMPLETE
    }
    
    UnderReview --> Draft : REVISION_REQUIRED (major changes)
    UnderReview --> PendingApproval : REVIEW_COMPLETE (all approved)
    UnderReview --> Withdrawn : WITHDRAW_DOCUMENT
    
    PendingApproval --> Approved : FINAL_APPROVAL
    PendingApproval --> UnderReview : APPROVAL_DECLINED
    PendingApproval --> Rejected : FINAL_REJECTION
    
    Approved --> [*]
    Rejected --> [*]
    Withdrawn --> [*]
    
    note right of ReviewRequested
        Reviewers notified
        Deadline set (3d default)
        Review tasks created
    end note
    
    note right of UnderReview
        Parallel review process
        Collaborative feedback
        Version control active
    end note
    
    note right of PendingApproval
        Authority validation
        Approval audit trail
        5 day timeout
    end note`;

// ============================================================================
// STORY DEFINITIONS  
// ============================================================================

export const OrderProcessingStateMachine: Story = {
  args: {
    title: "E-commerce Order State Machine",
    description: "Complete order lifecycle from cart to delivery with payment processing, fulfillment, and cancellation flows.",
    dataPanelTitle: "State Machine Configuration (YAML)",
    diagramPanelTitle: "Order State Diagram",
    dataPanel: (
      <DataViewer
        data={orderStateMachineYaml}
        language="yaml"
        title="order-state-machine.yml"
      />
    ),
    diagramPanel: (
      <MermaidRenderer 
        chart={orderStateMermaid}
        title="Order Processing States"
      />
    ),
  },
};

export const UserSessionStateMachine: Story = {
  args: {
    title: "User Session Management",
    description: "User authentication and session lifecycle including MFA, timeouts, and security lockouts.",
    dataPanelTitle: "Session Configuration (YAML)",
    diagramPanelTitle: "Session State Diagram", 
    dataPanel: (
      <DataViewer
        data={userSessionMachineYaml}
        language="yaml"
        title="user-session.yml"
      />
    ),
    diagramPanel: (
      <MermaidRenderer 
        chart={userSessionMermaid}
        title="User Session States"
      />
    ),
  },
};

export const WorkflowApprovalStateMachine: Story = {
  args: {
    title: "Document Approval Workflow",
    description: "Multi-stage document approval process with role-based permissions and escalation rules.",
    dataPanelTitle: "Workflow Configuration (YAML)",
    diagramPanelTitle: "Approval State Diagram",
    dataPanel: (
      <DataViewer
        data={workflowApprovalYaml}
        language="yaml"
        title="approval-workflow.yml"
      />
    ),
    diagramPanel: (
      <MermaidRenderer 
        chart={workflowApprovalMermaid}
        title="Document Approval Workflow"
      />
    ),
  },
};

const gameStateMachineYaml = `# Game Session State Machine
name: "Multiplayer Game Session"
version: "1.0.0"

initial_state: "lobby"

# Game States
states:
  lobby:
    type: "initial"
    description: "Players waiting to start game"
    min_players: 2
    max_players: 8
    entry_actions: ["create_room", "invite_players"]
    allowed_actions: ["chat", "ready_up", "leave_game"]
    
  starting:
    type: "transient"
    description: "Game initialization in progress"
    timeout: "10s"
    entry_actions: ["initialize_game", "sync_players", "load_assets"]
    
  active_game:
    type: "compound"
    description: "Game in progress"
    substates:
      - "player_turn"
      - "waiting_for_input"
      - "processing_move"
      - "round_end"
    
  paused:
    type: "atomic"
    description: "Game paused by player or system"
    timeout: "5m"
    entry_actions: ["freeze_game_state", "notify_players"]
    
  game_over:
    type: "atomic"
    description: "Game completed with results"
    entry_actions: ["calculate_scores", "update_leaderboard", "save_replay"]
    
  disconnected:
    type: "atomic"
    description: "Connection issues detected"
    timeout: "30s"
    entry_actions: ["attempt_reconnection", "pause_if_needed"]
    
  abandoned:
    type: "final"
    description: "Game abandoned due to disconnections"
    entry_actions: ["cleanup_resources", "log_abandonment"]

# Game Transitions
transitions:
  - from: "lobby"
    to: "starting"
    event: "START_GAME"
    guard: "min_players_ready && all_players_connected"
    
  - from: "starting"
    to: "active_game"
    event: "GAME_INITIALIZED"
    guard: "assets_loaded && players_synced"
    
  - from: "starting"
    to: "lobby"
    event: "INITIALIZATION_FAILED"
    actions: ["reset_room", "notify_error"]
    
  - from: "active_game"
    to: "paused"
    event: "PAUSE_REQUEST"
    guard: "pause_allowed"
    
  - from: "active_game"
    to: "disconnected"
    event: "CONNECTION_LOST"
    guard: "critical_player_disconnected"
    
  - from: "active_game"
    to: "game_over"
    event: "GAME_COMPLETED"
    
  - from: "paused"
    to: "active_game"
    event: "RESUME_GAME"
    guard: "all_players_ready"
    
  - from: "paused"
    to: "abandoned"
    event: "PAUSE_TIMEOUT"
    
  - from: "disconnected"
    to: "active_game"
    event: "RECONNECTION_SUCCESS"
    guard: "game_state_valid"
    
  - from: "disconnected"
    to: "abandoned"
    event: "RECONNECTION_FAILED"
    
  - from: "game_over"
    to: "lobby"
    event: "PLAY_AGAIN"
    guard: "players_want_rematch"

# Game Rules
game_rules:
  turn_timer:
    default: "30s"
    blitz_mode: "10s"
    tournament: "60s"
    
  reconnection:
    attempts: 3
    timeout: "30s"
    grace_period: "2m"
    
  scoring:
    victory_points: 100
    time_bonus: "10pts/second"
    completion_bonus: 50`;

const gameStateMermaid = `stateDiagram-v2
    [*] --> Lobby
    
    Lobby --> Starting : START_GAME (min players ready)
    Lobby --> [*] : ALL_PLAYERS_LEAVE
    
    Starting --> ActiveGame : GAME_INITIALIZED
    Starting --> Lobby : INITIALIZATION_FAILED
    
    state ActiveGame {
        [*] --> PlayerTurn
        PlayerTurn --> WaitingForInput : turn_started
        WaitingForInput --> ProcessingMove : input_received
        ProcessingMove --> RoundEnd : move_validated
        ProcessingMove --> WaitingForInput : invalid_move
        RoundEnd --> PlayerTurn : next_turn
        RoundEnd --> [*] : game_complete
    }
    
    ActiveGame --> Paused : PAUSE_REQUEST
    ActiveGame --> Disconnected : CONNECTION_LOST
    ActiveGame --> GameOver : GAME_COMPLETED
    
    Paused --> ActiveGame : RESUME_GAME
    Paused --> Abandoned : PAUSE_TIMEOUT (5m)
    
    Disconnected --> ActiveGame : RECONNECTION_SUCCESS
    Disconnected --> Abandoned : RECONNECTION_FAILED (30s)
    
    GameOver --> Lobby : PLAY_AGAIN
    GameOver --> [*] : EXIT_GAME
    
    Abandoned --> [*]
    
    note right of Lobby
        2-8 players
        Ready check required
        Chat enabled
    end note
    
    note right of ActiveGame
        Turn-based gameplay
        Move validation
        Real-time sync
    end note
    
    note right of Disconnected
        Auto-reconnection
        3 retry attempts
        30s timeout
    end note`;

export const GameSessionStateMachine: Story = {
  args: {
    title: "Multiplayer Game Session",
    description: "Game session lifecycle with lobby, gameplay, pausing, and connection management.",
    dataPanelTitle: "Game Configuration (YAML)",
    diagramPanelTitle: "Game State Diagram",
    dataPanel: (
      <DataViewer
        data={gameStateMachineYaml}
        language="yaml"
        title="game-session.yml"
      />
    ),
    diagramPanel: (
      <MermaidRenderer 
        chart={gameStateMermaid}
        title="Game Session States"
      />
    ),
  },
};