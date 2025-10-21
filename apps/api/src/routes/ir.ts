import { Hono } from "hono";

type Dependencies = Record<string, unknown>;

export function createIrRouter(deps: Dependencies) {
  const router = new Hono();

  router.get("/ir/flow", async (c) => {
    const projectId = c.req.query("projectId");

    if (!projectId) {
      return c.json({ error: "projectId parameter is required" }, 400);
    }

    // Mock intermediate representation flow data
    return c.json({
      success: true,
      projectId,
      flows: [
        {
          id: "user-registration",
          name: "User Registration",
          description: "New user sign-up process",
          nodes: [
            {
              id: "start",
              type: "start",
              position: { x: 0, y: 0 },
              data: { label: "Start Registration" },
            },
            {
              id: "form",
              type: "form",
              position: { x: 200, y: 0 },
              data: { label: "Registration Form", fields: ["email", "password", "name"] },
            },
            {
              id: "validate",
              type: "decision",
              position: { x: 400, y: 0 },
              data: { label: "Validate Input" },
            },
            {
              id: "create-user",
              type: "action",
              position: { x: 600, y: 0 },
              data: { label: "Create User Account" },
            },
            {
              id: "send-email",
              type: "action",
              position: { x: 800, y: 0 },
              data: { label: "Send Welcome Email" },
            },
            {
              id: "success",
              type: "end",
              position: { x: 1000, y: 0 },
              data: { label: "Registration Complete" },
            },
          ],
          edges: [
            { id: "e1", source: "start", target: "form" },
            { id: "e2", source: "form", target: "validate" },
            { id: "e3", source: "validate", target: "create-user", data: { label: "Valid" } },
            { id: "e4", source: "create-user", target: "send-email" },
            { id: "e5", source: "send-email", target: "success" },
            { id: "e6", source: "validate", target: "form", data: { label: "Invalid" } },
          ],
        },
        {
          id: "user-login",
          name: "User Login",
          description: "User authentication process",
          nodes: [
            {
              id: "start",
              type: "start",
              position: { x: 0, y: 100 },
              data: { label: "Start Login" },
            },
            {
              id: "credentials",
              type: "form",
              position: { x: 200, y: 100 },
              data: { label: "Enter Credentials", fields: ["email", "password"] },
            },
            {
              id: "authenticate",
              type: "action",
              position: { x: 400, y: 100 },
              data: { label: "Authenticate User" },
            },
            {
              id: "success",
              type: "end",
              position: { x: 600, y: 100 },
              data: { label: "Login Successful" },
            },
          ],
          edges: [
            { id: "e1", source: "start", target: "credentials" },
            { id: "e2", source: "credentials", target: "authenticate" },
            { id: "e3", source: "authenticate", target: "success" },
          ],
        },
      ],
    });
  });

  router.get("/ir/site", async (c) => {
    const projectId = c.req.query("projectId");

    if (!projectId) {
      return c.json({ error: "projectId parameter is required" }, 400);
    }

    // Mock site DAG data
    return c.json({
      success: true,
      projectId,
      site: {
        id: "main-site",
        name: "Application Site Map",
        description: "Complete site architecture and page relationships",
        pages: [
          {
            id: "home",
            path: "/",
            name: "Home Page",
            component: "HomePage",
            dependencies: ["auth", "api"],
            children: ["dashboard", "profile"],
          },
          {
            id: "dashboard",
            path: "/dashboard",
            name: "User Dashboard",
            component: "Dashboard",
            dependencies: ["auth", "api", "charts"],
            parent: "home",
          },
          {
            id: "profile",
            path: "/profile",
            name: "User Profile",
            component: "Profile",
            dependencies: ["auth", "api"],
            parent: "home",
          },
        ],
        dependencies: [
          { id: "auth", name: "Authentication Service", type: "service" },
          { id: "api", name: "REST API", type: "api" },
          { id: "charts", name: "Chart Module", type: "module" },
        ],
      },
    });
  });

  router.get("/ir/fsm", async (c) => {
    const projectId = c.req.query("projectId");

    if (!projectId) {
      return c.json({ error: "projectId parameter is required" }, 400);
    }

    // Mock FSM (Finite State Machine) data
    return c.json({
      success: true,
      projectId,
      fsm: {
        id: "user-state-machine",
        name: "User Authentication FSM",
        description: "State transitions for user authentication flow",
        initialState: "logged_out",
        states: [
          {
            id: "logged_out",
            name: "Logged Out",
            type: "initial",
            transitions: ["logging_in"],
          },
          {
            id: "logging_in",
            name: "Logging In",
            type: "transition",
            transitions: ["logged_in", "login_failed"],
          },
          {
            id: "logged_in",
            name: "Logged In",
            type: "active",
            transitions: ["logging_out", "session_expired"],
          },
          {
            id: "login_failed",
            name: "Login Failed",
            type: "error",
            transitions: ["logged_out", "logging_in"],
          },
          {
            id: "logging_out",
            name: "Logging Out",
            type: "transition",
            transitions: ["logged_out"],
          },
          {
            id: "session_expired",
            name: "Session Expired",
            type: "error",
            transitions: ["logged_out"],
          },
        ],
        transitions: [
          { from: "logged_out", to: "logging_in", trigger: "login_attempt" },
          { from: "logging_in", to: "logged_in", trigger: "login_success" },
          { from: "logging_in", to: "login_failed", trigger: "login_failure" },
          { from: "login_failed", to: "logging_in", trigger: "retry_login" },
          { from: "login_failed", to: "logged_out", trigger: "cancel_login" },
          { from: "logged_in", to: "logging_out", trigger: "logout_request" },
          { from: "logged_in", to: "session_expired", trigger: "session_timeout" },
          { from: "logging_out", to: "logged_out", trigger: "logout_complete" },
          { from: "session_expired", to: "logged_out", trigger: "session_cleanup" },
        ],
      },
    });
  });

  router.get("/ir/view", async (c) => {
    const projectId = c.req.query("projectId");

    if (!projectId) {
      return c.json({ error: "projectId parameter is required" }, 400);
    }

    // Mock view wireframes data
    return c.json({
      success: true,
      projectId,
      views: [
        {
          id: "login-view",
          name: "Login View",
          type: "page",
          description: "User authentication interface",
          components: [
            {
              id: "header",
              type: "header",
              position: { x: 0, y: 0, width: 100, height: 10 },
              content: "Application Logo",
            },
            {
              id: "login-form",
              type: "form",
              position: { x: 20, y: 30, width: 60, height: 40 },
              content: "Email/Password Form",
              fields: ["email", "password"],
              actions: ["login", "forgot-password"],
            },
            {
              id: "footer",
              type: "footer",
              position: { x: 0, y: 90, width: 100, height: 10 },
              content: "Copyright & Links",
            },
          ],
        },
        {
          id: "dashboard-view",
          name: "Dashboard View",
          type: "page",
          description: "Main application dashboard",
          components: [
            {
              id: "nav",
              type: "navigation",
              position: { x: 0, y: 0, width: 100, height: 15 },
              content: "Main Navigation",
            },
            {
              id: "sidebar",
              type: "sidebar",
              position: { x: 0, y: 15, width: 20, height: 75 },
              content: "Menu & Tools",
            },
            {
              id: "main-content",
              type: "content",
              position: { x: 20, y: 15, width: 80, height: 75 },
              content: "Dashboard Widgets",
            },
            {
              id: "status-bar",
              type: "status",
              position: { x: 0, y: 90, width: 100, height: 10 },
              content: "Status Information",
            },
          ],
        },
      ],
    });
  });

  return router;
}
