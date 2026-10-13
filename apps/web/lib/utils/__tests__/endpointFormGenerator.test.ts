import { describe, it, expect } from "vitest";
import {
  extractEndpointFields,
  extractEndpointResponseFields,
  inferDefaultButtonLabel,
  inferDefaultComponentName,
  generateFormFromEndpoint,
} from "../endpointFormGenerator";
import { Endpoint, BackendNode, BackendEdge } from "@/types/canvas";

describe("endpointFormGenerator", () => {
  const sampleEndpoint: Endpoint = {
    id: "ep-users-create",
    name: "/api/v1/users",
    type: "POST",
    summary: "Create a new user",
    pathParams: [
      { id: "p-org", name: "orgId", type: "string", required: true },
    ],
    queryParams: [
      { id: "q-notify", name: "sendWelcomeEmail", type: "boolean", required: false },
    ],
    requestBody: {
      id: "body-1",
      fields: [
        { id: "f-name", name: "fullName", type: "string", required: true },
        { id: "f-email", name: "email", type: "string", required: true },
        { id: "f-pass", name: "password", type: "string", required: true },
        { id: "f-age", name: "age", type: "number", required: false },
        { id: "f-admin", name: "isAdmin", type: "boolean", required: false },
      ],
    },
  };

  it("extracts and infers input types accurately from endpoint contract", () => {
    const fields = extractEndpointFields(sampleEndpoint);
    expect(fields).toHaveLength(7); // 5 body + 1 path + 1 query

    const nameField = fields.find((f) => f.name === "fullName");
    expect(nameField?.suggestedComponentType).toBe("input");
    expect(nameField?.suggestedInputType).toBe("text");
    expect(nameField?.label).toBe("Full Name");
    expect(nameField?.required).toBe(true);

    const emailField = fields.find((f) => f.name === "email");
    expect(emailField?.suggestedInputType).toBe("email");
    expect(emailField?.placeholder).toBe("name@example.com");

    const passField = fields.find((f) => f.name === "password");
    expect(passField?.suggestedInputType).toBe("password");

    const ageField = fields.find((f) => f.name === "age");
    expect(ageField?.suggestedInputType).toBe("number");

    const adminField = fields.find((f) => f.name === "isAdmin");
    expect(adminField?.suggestedComponentType).toBe("switch");

    const orgField = fields.find((f) => f.name === "orgId");
    expect(orgField?.source).toBe("path");
    expect(orgField?.required).toBe(true);
  });

  it("extracts from rawJson fallback when field_builder fields are missing", () => {
    const rawEp: Endpoint = {
      id: "ep-raw",
      name: "/api/raw",
      type: "POST",
      requestBody: {
        id: "b-raw",
        rawJson: JSON.stringify({
          title: "Book",
          price: 29.99,
          inStock: true,
        }),
      },
    };

    const fields = extractEndpointFields(rawEp);
    expect(fields).toHaveLength(3);
    expect(fields.find((f) => f.name === "title")?.type).toBe("string");
    expect(fields.find((f) => f.name === "price")?.type).toBe("number");
    expect(fields.find((f) => f.name === "inStock")?.type).toBe("boolean");
    expect(fields.find((f) => f.name === "inStock")?.suggestedComponentType).toBe("switch");
  });

  it("generates compound form component, Zustand state store, and wires action edge", () => {
    const webPageNode: BackendNode = {
      id: "node-page-1",
      type: "webPage",
      position: { x: 500, y: 200 },
      fractionalIndex: "a0",
      data: {
        label: "/register",
        sections: [
          {
            id: "sec-1",
            name: "Main",
            renderMode: "server",
            actions: [],
            componentBindings: [],
          },
        ],
      },
    };

    const serviceNode: BackendNode = {
      id: "node-service-1",
      type: "service",
      position: { x: 1000, y: 200 },
      fractionalIndex: "a1",
      data: {
        label: "UserService",
      },
    };

    const existingStoreNode: BackendNode = {
      id: "node-store-1",
      type: "state_store",
      position: { x: 100, y: 200 },
      fractionalIndex: "a2",
      data: {
        label: "UserStore",
        storeName: "User",
        fields: [],
        actions: [],
      },
    };

    const extracted = extractEndpointFields(sampleEndpoint);
    const selectedFields = extracted.map((f) => ({
      name: f.name,
      source: f.source,
      type: f.type,
      required: f.required,
      componentType: f.suggestedComponentType,
      inputType: f.suggestedInputType,
      label: f.label,
      placeholder: f.placeholder,
      stateVarName: f.name,
    }));

    const result = generateFormFromEndpoint({
      endpoint: sampleEndpoint,
      serviceNode,
      webPageNode,
      sectionId: "sec-1",
      formName: "UserRegistrationForm",
      submitButtonLabel: "Create Account",
      stateStorageMode: "store",
      targetStoreNodeId: existingStoreNode.id,
      selectedFields,
      nodes: [webPageNode, serviceNode, existingStoreNode],
      edges: [],
    });

    // 1. Verify updated store node
    expect(result.updatedStoreNode).toBeDefined();
    expect(result.updatedStoreNode?.data?.fields).toHaveLength(7);
    expect(result.updatedStoreNode?.data?.actions).toHaveLength(7);
    const emailField = result.updatedStoreNode?.data?.fields?.find((f) => f.name === "email");
    expect(emailField).toBeDefined();
    const emailSetter = result.updatedStoreNode?.data?.actions?.find((a) => a.name === "setEmail");
    expect(emailSetter).toBeDefined();

    // 2. Verify new edges (store -> page edge AND action -> service endpoint edge)
    expect(result.newEdges).toHaveLength(2);
    const storeEdge = result.newEdges.find((e) => e.source === existingStoreNode.id && e.target === webPageNode.id);
    expect(storeEdge).toBeDefined();
    const actionEdge = result.newEdges.find((e) => e.source === webPageNode.id && e.target === serviceNode.id);
    expect(actionEdge).toBeDefined();
    expect(actionEdge?.targetHandle).toBe("endpoint-in-ep-users-create");

    // 3. Verify updated webPage node
    const updatedSec = result.updatedWebPageNode.data?.sections?.[0];
    expect(updatedSec).toBeDefined();
    expect(updatedSec?.renderMode).toBe("client");

    // Subscribed store state objects
    expect(updatedSec?.stateObjects).toHaveLength(7);
    expect(updatedSec?.stateObjects?.[0]?.storeName).toBe("User");

    // Component bindings
    expect(updatedSec?.componentBindings).toHaveLength(1);
    const formComp = updatedSec?.componentBindings?.[0];
    expect(formComp?.name).toBe("UserRegistrationForm");
    expect(formComp?.valueStoreName).toBe("User");
    expect(formComp?.elements).toHaveLength(8); // 7 inputs + 1 submit button

    // Submit button element
    const submitBtn = formComp?.elements?.find((el) => el.name === "SubmitButton");
    expect(submitBtn).toBeDefined();
    expect(submitBtn?.elementType).toBe("button");
    expect(submitBtn?.label).toBe("Create Account");
    expect(submitBtn?.actionId).toBe(result.createdActionId);
  });

  it("creates a brand new StateStore node when targetStoreNodeId is '__new__'", () => {
    const webPageNode: BackendNode = {
      id: "node-page-2",
      type: "webPage",
      position: { x: 500, y: 200 },
      fractionalIndex: "a0",
      data: {
        label: "/profile",
        sections: [
          {
            id: "sec-2",
            name: "Profile",
            actions: [],
            componentBindings: [],
          },
        ],
      },
    };

    const serviceNode: BackendNode = {
      id: "node-service-2",
      type: "service",
      position: { x: 900, y: 200 },
      fractionalIndex: "a1",
      data: { label: "ProfileService" },
    };

    const extracted = extractEndpointFields(sampleEndpoint).slice(0, 2);
    const selectedFields = extracted.map((f) => ({
      name: f.name,
      source: f.source,
      type: f.type,
      required: f.required,
      componentType: f.suggestedComponentType,
      inputType: f.suggestedInputType,
      label: f.label,
      placeholder: f.placeholder,
      stateVarName: f.name,
    }));

    const result = generateFormFromEndpoint({
      endpoint: sampleEndpoint,
      serviceNode,
      webPageNode,
      sectionId: "sec-2",
      formName: "ProfileForm",
      submitButtonLabel: "Save Profile",
      stateStorageMode: "store",
      targetStoreNodeId: "__new__",
      newStoreName: "AccountStore",
      selectedFields,
      nodes: [webPageNode, serviceNode],
      edges: [],
    });

    expect(result.newStoreNode).toBeDefined();
    expect(result.newStoreNode?.type).toBe("state_store");
    expect(result.newStoreNode?.data?.label).toBe("AccountStore");
    expect(result.newStoreNode?.data?.storeName).toBe("Account");
    expect(result.newStoreNode?.data?.fields).toHaveLength(2);
    expect(result.newStoreNode?.data?.actions).toHaveLength(2);
  });

  describe("label and name inference", () => {
    it("infers smart button labels based on route semantics and input presence", () => {
      expect(inferDefaultButtonLabel({ id: "1", name: "/health", type: "GET" }, false)).toBe("Check Health");
      expect(inferDefaultButtonLabel({ id: "2", name: "/api/v1/auth/logout", type: "POST" }, false)).toBe("Log Out");
      expect(inferDefaultButtonLabel({ id: "3", name: "/sync", type: "POST" }, false)).toBe("Sync Now");
      expect(inferDefaultButtonLabel({ id: "4", name: "/users", type: "GET" }, false)).toBe("Fetch Users");
      expect(inferDefaultButtonLabel({ id: "5", name: "/users", type: "GET" }, true)).toBe("Search Users");
      expect(inferDefaultButtonLabel({ id: "6", name: "/users", type: "POST" }, true)).toBe("Create Users");
      expect(inferDefaultButtonLabel({ id: "7", name: "/users/1", type: "PUT" }, true)).toBe("Save Changes");
      expect(inferDefaultButtonLabel({ id: "8", name: "/items/1", type: "DELETE" }, false)).toBe("Delete 1");
    });

    it("infers smart component names (Button for parameterless, Form for inputs)", () => {
      expect(inferDefaultComponentName({ id: "1", name: "/health", type: "GET" }, false)).toBe("HealthButton");
      expect(inferDefaultComponentName({ id: "2", name: "/health", type: "GET" }, true)).toBe("HealthForm");
      expect(inferDefaultComponentName({ id: "3", name: "/api/users", type: "POST" }, false)).toBe("UsersButton");
      expect(inferDefaultComponentName({ id: "4", name: "/api/users", type: "POST" }, true)).toBe("UsersForm");
    });
  });

  describe("extractEndpointResponseFields", () => {
    it("extracts from responseBody.fields", () => {
      const ep: Endpoint = {
        id: "ep-res-1",
        name: "/status",
        type: "GET",
        responseBody: {
          id: "rb-1",
          fields: [
            { id: "rf-1", name: "status", type: "string", required: false },
            { id: "rf-2", name: "uptime", type: "number", required: false },
          ],
        },
      };

      const fields = extractEndpointResponseFields(ep);
      expect(fields).toHaveLength(2);
      expect(fields[0]?.name).toBe("status");
      expect(fields[0]?.type).toBe("string");
      expect(fields[1]?.name).toBe("uptime");
      expect(fields[1]?.type).toBe("number");
    });

    it("extracts from responseBody.rawJson fallback", () => {
      const ep: Endpoint = {
        id: "ep-raw-res",
        name: "/health",
        type: "GET",
        responseBody: {
          id: "rb-raw",
          rawJson: JSON.stringify({ alive: true, version: "1.0.0" }),
        },
      };

      const fields = extractEndpointResponseFields(ep);
      expect(fields).toHaveLength(2);
      expect(fields.find((f) => f.name === "alive")?.type).toBe("boolean");
      expect(fields.find((f) => f.name === "version")?.type).toBe("string");
    });
  });

  describe("parameterless GET / action button generation", () => {
    it("generates standalone Action Button (componentType: 'button') and stores response fields", () => {
      const healthEndpoint: Endpoint = {
        id: "ep-health-check",
        name: "/health",
        type: "GET",
        summary: "Health check",
        responseBody: {
          id: "res-health",
          fields: [
            { id: "rf-status", name: "serverStatus", type: "string", required: false },
            { id: "rf-timestamp", name: "checkedAt", type: "string", required: false },
          ],
        },
      };

      const webPageNode: BackendNode = {
        id: "node-page-health",
        type: "webPage",
        position: { x: 400, y: 150 },
        fractionalIndex: "a0",
        data: {
          label: "/dashboard",
          sections: [
            {
              id: "sec-health",
              name: "SystemOverview",
              renderMode: "server",
              actions: [],
              componentBindings: [],
            },
          ],
        },
      };

      const serviceNode: BackendNode = {
        id: "node-service-health",
        type: "service",
        position: { x: 800, y: 150 },
        fractionalIndex: "a1",
        data: { label: "HealthService" },
      };

      const storeNode: BackendNode = {
        id: "node-store-health",
        type: "state_store",
        position: { x: 100, y: 150 },
        fractionalIndex: "a2",
        data: {
          label: "HealthStore",
          storeName: "Health",
          fields: [],
          actions: [],
        },
      };

      const result = generateFormFromEndpoint({
        endpoint: healthEndpoint,
        serviceNode,
        webPageNode,
        sectionId: "sec-health",
        formName: "HealthButton",
        submitButtonLabel: "Check Health",
        stateStorageMode: "store",
        targetStoreNodeId: storeNode.id,
        selectedFields: [], // 0 input parameters!
        responseFieldsToStore: ["serverStatus", "checkedAt"],
        nodes: [webPageNode, serviceNode, storeNode],
        edges: [],
      });

      // 1. Should create componentType: "button"
      const section = result.updatedWebPageNode.data?.sections?.[0];
      expect(section).toBeDefined();
      expect(section?.componentBindings).toHaveLength(1);
      const buttonComp = section?.componentBindings?.[0];
      expect(buttonComp?.name).toBe("HealthButton");
      expect(buttonComp?.componentType).toBe("button");
      expect(buttonComp?.elements).toHaveLength(1);
      expect(buttonComp?.elements?.[0]?.elementType).toBe("button");
      expect(buttonComp?.elements?.[0]?.label).toBe("Check Health");
      expect(buttonComp?.elements?.[0]?.actionId).toBe(result.createdActionId);

      // 2. Action wiring to service endpoint
      const actionEdge = result.newEdges.find(
        (e) => e.source === webPageNode.id && e.target === serviceNode.id
      );
      expect(actionEdge).toBeDefined();
      expect(actionEdge?.targetHandle).toBe("endpoint-in-ep-health-check");

      // 3. Store fields created for response variables
      expect(result.updatedStoreNode).toBeDefined();
      expect(result.updatedStoreNode?.data?.fields).toHaveLength(2);
      expect(result.updatedStoreNode?.data?.actions).toHaveLength(2);
      const statusField = result.updatedStoreNode?.data?.fields?.find((f) => f.name === "serverStatus");
      expect(statusField).toBeDefined();
      const statusSetter = result.updatedStoreNode?.data?.actions?.find((a) => a.name === "setServerStatus");
      expect(statusSetter).toBeDefined();

      // 4. Section subscribed to response state variables
      expect(section?.stateObjects).toHaveLength(2);
      expect(section?.stateObjects?.find((s) => s.name === "serverStatus")).toBeDefined();

      // 5. Summary message mentions button
      expect(result.summaryMessage).toContain("action button");
    });
  });
});
