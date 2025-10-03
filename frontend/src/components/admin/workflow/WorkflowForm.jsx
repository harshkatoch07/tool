import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Form, Input, Select, Button, message, Card, Spin, Switch } from "antd";
import {
  createWorkflow,
  getWorkflowById,
  updateWorkflow,
  getDesignations,
} from "../../../api/workflowApi";
import { useNavigate, useParams } from "react-router-dom";

const { Option } = Select;

export default function WorkflowForm() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams();

  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]); // [{id, name}]
  const [finalReceiverUsers, setFinalReceiverUsers] = useState([]); // [{id, fullName, email, designationId, designationName}]
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem("token");

  // ---- helpers --------------------------------------------------------------
  const apiGet = async (url) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  const normalizeUser = (u) => ({
    id: u.id ?? u.userID ?? u.UserID,
    email: u.email ?? u.Email ?? u.EmailID ?? "",
    fullName: u.fullName ?? u.FullName ?? u.username ?? "User",
    designationId:
      u.designationId ??
      u.DesignationId ??
      u.DesignationID ??
      u.designation?.id ??
      u.designation?.Id ??
      null,
    designationName:
      u.designationName ??
      u.DesignationName ??
      u.designation?.name ??
      u.designation?.Name ??
      "—",
  });

  const fetchAllUsers = useCallback(
    async (deptList) => {
      try {
        try {
          const maybeFull = await apiGet(
            `/api/admin/users?includeDesignation=true&pageSize=10000`
          );
          if (Array.isArray(maybeFull) && maybeFull.length > 0) {
            const normalized = maybeFull.map(normalizeUser);
            setFinalReceiverUsers(normalized);
            return;
          }
        } catch {
          /* fallback */
        }

        const list =
          Array.isArray(deptList) && deptList.length
            ? deptList
            : await apiGet(`/api/admin/departments`).then((d) =>
                (Array.isArray(d) ? d : []).map((x) => ({
                  departmentId: x.id ?? x.departmentId ?? 0,
                }))
              );

        const results = await Promise.allSettled(
          list.map((d) =>
            apiGet(
              `/api/admin/users?departmentId=${encodeURIComponent(
                d.departmentId
              )}`
            )
          )
        );

        const merged = [];
        const seen = new Set();
        for (const r of results) {
          if (r.status !== "fulfilled" || !Array.isArray(r.value)) continue;
          for (const raw of r.value) {
            const u = normalizeUser(raw);
            if (!u.id || seen.has(u.id)) continue;
            seen.add(u.id);
            merged.push(u);
          }
        }
        setFinalReceiverUsers(merged);
      } catch (e) {
        console.error(e);
        message.error("Failed to load users");
        setFinalReceiverUsers([]);
      }
    },
    [token]
  );

  const fetchDesignations = useCallback(async (search = "") => {
    try {
      const data = await getDesignations(search);
      setDesignations(Array.isArray(data) ? data : []);
    } catch {
      message.error("Failed to load designations");
    }
  }, []);

  const normalizeKey = (s) => (s ?? "").toString().trim().toLowerCase();

  const usersByDesignationId = useMemo(() => {
    const m = new Map();
    for (const u of finalReceiverUsers) {
      if (u.designationId != null) {
        if (!m.has(u.designationId)) m.set(u.designationId, []);
        m.get(u.designationId).push(u);
      }
    }
    for (const [, arr] of m)
      arr.sort((a, b) => a.fullName.localeCompare(b.fullName));
    return m;
  }, [finalReceiverUsers]);

  const usersByDesignationName = useMemo(() => {
    const m = new Map();
    for (const u of finalReceiverUsers) {
      const key = normalizeKey(u.designationName);
      if (!key) continue;
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(u);
    }
    for (const [, arr] of m)
      arr.sort((a, b) => a.fullName.localeCompare(b.fullName));
    return m;
  }, [finalReceiverUsers]);

  const peopleForDesignation = (d) =>
    usersByDesignationId.get(d.id) ||
    usersByDesignationName.get(normalizeKey(d.name)) ||
    [];

  const loadWorkflow = useCallback(
    async (workflowId) => {
      try {
        setLoading(true);
        const workflow = await getWorkflowById(workflowId, token);
        const existingFRUsers =
          (workflow.finalReceivers || []).map((r) => ({
            id: r.userId,
            fullName: r.userName || r.user || `User#${r.userId}`,
            email: r.email || "",
            designationId: r.designationId ?? null,
            designationName: r.designationName ?? "—",
          })) || [];

        setFinalReceiverUsers((prev) => {
          const map = new Map(prev.map((x) => [x.id, x]));
          for (const u of existingFRUsers) if (!map.has(u.id)) map.set(u.id, u);
          return Array.from(map.values());
        });

        form.setFieldsValue({
          name: workflow.name,
          description: workflow.description,
          departmentId: workflow.departmentId ?? 0,
          initiatorDesignationId:
            workflow.initiatorDesignationId ?? undefined,
          initiatorSlaHours: workflow.initiatorSlaHours || 0,
          template: workflow.template,
          textBoxName: workflow.textBoxName,
          steps: (workflow.steps || [])
            .filter((s) => s.stepName !== "Initiator")
            .map((s, idx) => ({
              stepName: s.stepName || `Approver ${idx + 1}`,
              slaHours: s.slaHours ?? s.SLAHours ?? 0,
              designationId: s.designationId,
              autoApprove: s.autoApprove ?? false,
            })),
          finalReceivers: (workflow.finalReceivers || []).map((r) => r.userId),
          isActive:
            workflow.isActive !== undefined ? workflow.isActive : true,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    },
    [form, token]
  );

  useEffect(() => {
    fetch("/api/admin/departments", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(async (data) => {
        const normalized = (Array.isArray(data) ? data : []).map((d) => ({
          departmentId: d.id ?? d.departmentId ?? 0,
          departmentName:
            d.name ??
            d.departmentName ??
            String(d.id ?? d.departmentId ?? "Unknown"),
        }));
        setDepartments(normalized);
        await fetchAllUsers(normalized);
      })
      .catch(() => message.error("Failed to load departments"));

    fetchDesignations("");
    if (id && id !== "new") loadWorkflow(id);
  }, [fetchAllUsers, fetchDesignations, loadWorkflow, id, token]);

  const handleSubmit = async (values) => {
    const approvers = (values.steps || []).map((step, index) => ({
      stepName: step.stepName || `Approver ${index + 1}`,
      designationId: step.designationId,
      slaHours: step.slaHours || 0,
      autoApprove: step.autoApprove || false,
    }));

    const userIndex = new Map(finalReceiverUsers.map((u) => [u.id, u]));
    const finalReceiversPayload = (values.finalReceivers || [])
      .map((userId) => {
        const u = userIndex.get(userId);
        if (!u) return null;
        return {
          userId: u.id,
          designationId: u.designationId ?? null,
          designationName: u.designationName ?? null,
        };
      })
      .filter(Boolean);

    const workflowData = {
      name: values.name,
      description: values.description,
      departmentId: values.departmentId ?? 0,
      initiatorDesignationId: values.initiatorDesignationId,
      initiatorSlaHours: values.initiatorSlaHours || 0,
      approvers,
      finalReceivers: finalReceiversPayload,
      isActive: values.isActive === undefined ? true : values.isActive,
      template: values.template,
      textBoxName: values.textBoxName,
    };

    try {
      if (id && id !== "new") {
        await updateWorkflow(id, workflowData, token);
        message.success("Workflow updated");
      } else {
        await createWorkflow(workflowData, token);
        message.success("Workflow created");
      }
      navigate("/admin/workflows");
    } catch (error) {
      console.error("Workflow Save Error:", error);
      message.error(
        id && id !== "new"
          ? "Failed to update workflow"
          : "Failed to create workflow"
      );
    }
  };

  if (loading)
    return (
      <div style={{ display: "flex", justifyContent: "center", marginTop: 50 }}>
        <Spin size="large" />
      </div>
    );

  const userMiniLine = (u) =>
    `${u.fullName}${u.email ? ` (${u.email})` : ""}`;
  const optionSearchLabel = (d, people) =>
    `${d.name} ${people
      .map((u) => `${u.fullName} ${u.email || ""}`)
      .join(" ")}`;

  return (
    <div style={{ padding: 32 }}>
      <h2>{id && id !== "new" ? "Edit Workflow" : "Create Workflow"}</h2>
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="name"
          label="Workflow Name"
          rules={[{ required: true, message: "'name' is required" }]}
        >
          <Input />
        </Form.Item>

        <Form.Item name="description" label="Description">
          <Input />
        </Form.Item>

        <Form.Item name="departmentId" label="Workflow Department">
          <Select allowClear placeholder="Select Department">
            {departments.map((d) => (
              <Option key={d.departmentId} value={d.departmentId}>
                {d.departmentName}
              </Option>
            ))}
          </Select>
        </Form.Item>

        {/* Initiator Designation */}
        <Form.Item
          name="initiatorDesignationId"
          label="Initiator Designation"
          rules={[
            { required: true, message: "Please select initiator designation!" },
          ]}
        >
          <Select
            showSearch
            allowClear
            placeholder="Select Designation"
            onSearch={fetchDesignations}
            filterOption={(input, option) =>
              (option?.label || "").toLowerCase().includes(input.toLowerCase())
            }
            optionFilterProp="label"
          >
            {designations.map((d) => {
              const people = peopleForDesignation(d);
              const top = people.slice(0, 8);
              const label = optionSearchLabel(d, people);
              return (
                <Option key={d.id} value={d.id} label={label}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ fontWeight: 500 }}>{d.name}</div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#8c8c8c",
                        lineHeight: 1.6,
                      }}
                    >
                      {top.length
                        ? top.map(userMiniLine).join(" • ")
                        : "No active users with this designation"}
                      {people.length > top.length ? " • …" : ""}
                    </div>
                  </div>
                </Option>
              );
            })}
          </Select>
        </Form.Item>

        <Form.Item name="initiatorSlaHours" label="Initiator SLA (Hours)">
          <Input type="number" min={0} />
        </Form.Item>

        <Form.Item name="template" label="Template">
          <Input />
        </Form.Item>

        <Form.Item name="textBoxName" label="Textbox Name">
          <Input />
        </Form.Item>

        {/* Approver Steps */}
        <Form.List name="steps">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name }) => (
                <Card key={key} style={{ marginBottom: 16 }}>
                  <Form.Item
                    label="Step Name"
                    name={[name, "stepName"]}
                    rules={[{ required: true }]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item label="SLA (Hours)" name={[name, "slaHours"]}>
                    <Input type="number" min={0} />
                  </Form.Item>
                  <Form.Item
                    label="Designation"
                    name={[name, "designationId"]}
                    rules={[
                      { required: true, message: "Please select a designation" },
                    ]}
                  >
                    <Select
                      showSearch
                      placeholder="Select Designation"
                      onSearch={fetchDesignations}
                      filterOption={(input, option) =>
                        (option?.label || "")
                          .toLowerCase()
                          .includes(input.toLowerCase())
                      }
                      optionFilterProp="label"
                    >
                      {designations.map((d) => {
                        const people = peopleForDesignation(d);
                        const top = people.slice(0, 8);
                        const label = optionSearchLabel(d, people);
                        return (
                          <Option key={d.id} value={d.id} label={label}>
                            <div
                              style={{ display: "flex", flexDirection: "column" }}
                            >
                              <div style={{ fontWeight: 500 }}>{d.name}</div>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "#8c8c8c",
                                  lineHeight: 1.6,
                                }}
                              >
                                {top.length
                                  ? top.map(userMiniLine).join(" • ")
                                  : "No active users with this designation"}
                                {people.length > top.length ? " • …" : ""}
                              </div>
                            </div>
                          </Option>
                        );
                      })}
                    </Select>
                  </Form.Item>
                  <Button danger onClick={() => remove(name)}>
                    Remove Step
                  </Button>
                </Card>
              ))}
              <Button type="dashed" onClick={() => add()} block>
                + Add Approver Step
              </Button>
            </>
          )}
        </Form.List>

        {/* Final Receivers */}
        <Card title="Final Receivers" style={{ marginTop: 24 }}>
          <Form.Item name="finalReceivers" label="Select Final Receivers">
            <Select
              mode="multiple"
              placeholder="Search and select users…"
              showSearch
              optionFilterProp="label"
              filterOption={(input, option) =>
                (option?.label || "")
                  .toLowerCase()
                  .includes(input.toLowerCase())
              }
            >
              {finalReceiverUsers.map((u) => (
                <Option
                  key={u.id}
                  value={u.id}
                  label={`${u.fullName}${u.email ? ` (${u.email})` : ""} • ${
                    u.designationName || "—"
                  }`}
                >
                  {u.fullName}{" "}
                  <span style={{ color: "#999" }}>
                    {u.email ? `• ${u.email} ` : ""}• {u.designationName || "—"}
                  </span>
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Card>

        <Form.Item
          name="isActive"
          label="Status"
          valuePropName="checked"
          initialValue={true}
        >
          <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
        </Form.Item>

        <div style={{ display: "flex", gap: 16 }}>
          <Button type="primary" htmlType="submit">
            {id && id !== "new" ? "Update Workflow" : "Create Workflow"}
          </Button>
          <Button
            onClick={() => navigate("/admin/workflows")}
            type="default"
            style={{ marginLeft: 8 }}
          >
            Close
          </Button>
        </div>
      </Form>
    </div>
  );
}
