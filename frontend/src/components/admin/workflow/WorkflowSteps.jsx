import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Table, Button, Modal, Form, Input, InputNumber, Switch, message, Popconfirm, Select } from "antd";
import { useParams } from "react-router-dom";
import { getWorkflowSteps } from "../../../api/workflowApi";
import { useAuth } from "../../../context/AuthContext";

const { Option } = Select;

export default function WorkflowSteps() {
  const { token } = useAuth();
  const { id } = useParams(); // Workflow ID
  const [steps, setSteps] = useState([]);
  const [finalReceivers, setFinalReceivers] = useState([]);
  const [designations, setDesignations] = useState([]);

  // 👇 used for the Final Receiver modal (filtered by designation)
  const [users, setUsers] = useState([]);

  // 👇 NEW: global user list for approver names
  const [allUsers, setAllUsers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isApproverModalOpen, setIsApproverModalOpen] = useState(false);
  const [isFinalReceiverModalOpen, setIsFinalReceiverModalOpen] = useState(false);
  const [selectedStepId, setSelectedStepId] = useState(null);

  const [form] = Form.useForm();
  const [approverForm] = Form.useForm();
  const [finalReceiverForm] = Form.useForm();

  // ------- helpers
  const apiGet = async (url) => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  const normalizeUser = (u) => ({
    id: u.id ?? u.userID ?? u.UserID,
    email: u.email ?? u.Email ?? u.EmailID ?? "",
    fullName: u.fullName ?? u.FullName ?? u.username ?? u.Username ?? "User",
    designationName: u.designationName ?? u.DesignationName ?? u?.designation?.name ?? "",
  });

  // 🔎 Build id → user map for quick lookup
  const userIndex = useMemo(() => new Map(allUsers.map((u) => [u.id, u])), [allUsers]);

  useEffect(() => {
    loadSteps();
    fetchDesignations();
    fetchFinalReceivers();
    fetchAllUsers(); // 🔹 load everyone once for approver names + picker
  }, [id]);

  const loadSteps = async () => {
    try {
      setLoading(true);
      const data = await getWorkflowSteps(id, token);
      setSteps(data);
    } catch {
      message.error("Failed to load workflow steps");
    } finally {
      setLoading(false);
    }
  };

  const fetchDesignations = async () => {
    try {
      const data = await apiGet(`/api/admin/designations`);
      setDesignations(Array.isArray(data) ? data : []);
    } catch {
      message.error("Failed to load designations");
    }
  };

  const fetchFinalReceivers = async () => {
    try {
      const data = await apiGet(`/api/workflows/${id}/final-receivers`);
      setFinalReceivers(data || []);
    } catch {
      message.error("Failed to load final receivers");
    }
  };

  // 🧲 Robust: try “all users”; if your backend pages by default, you can add a large pageSize.
  const fetchAllUsers = async () => {
    try {
      const data = await apiGet(`/api/admin/users`); // if paged, expose ?pageSize=10000 backend-side
      const normalized = (Array.isArray(data) ? data : []).map(normalizeUser);
      setAllUsers(normalized);
    } catch {
      message.error("Failed to load users");
      setAllUsers([]);
    }
  };

  // ---------- Final Receiver-specific user fetch (by designation)
  const fetchUsersByDesignation = async (designationName) => {
    try {
      const data = await apiGet(`/api/admin/users?designation=${encodeURIComponent(designationName)}`);
      setUsers((Array.isArray(data) ? data : []).map(normalizeUser));
    } catch {
      message.error("Failed to load users for this designation");
    }
  };

  // ---------- Step modal
  const handleAddStep = () => {
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleSaveStep = async (values) => {
    try {
      const response = await fetch(`/api/workflowsteps/${id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...values,
          autoApprove: values.autoApprove || false,
        }),
      });
      if (!response.ok) throw new Error("Failed to add step");
      message.success("Step added successfully");
      setIsModalOpen(false);
      loadSteps();
    } catch {
      message.error("Failed to add step");
    }
  };

  const handleDeleteStep = async (stepId) => {
    try {
      const response = await fetch(`/api/workflowsteps/${stepId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error();
      message.success("Step deleted");
      loadSteps();
    } catch {
      message.error("Failed to delete step");
    }
  };

  // ---------- Approvers
  const handleAddApprover = (stepId) => {
    setSelectedStepId(stepId);
    approverForm.resetFields();
    setIsApproverModalOpen(true);
  };

  const handleSaveApprover = async (values) => {
    try {
      const response = await fetch(`/api/workflowsteps/${selectedStepId}/approvers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(values), // { userId }
      });
      if (!response.ok) throw new Error();
      message.success("Approver added");
      setIsApproverModalOpen(false);
      loadSteps();
    } catch {
      message.error("Failed to add approver");
    }
  };

  const handleRemoveApprover = async (approverId) => {
    try {
      const response = await fetch(`/api/workflowsteps/approvers/${approverId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error();
      message.success("Approver removed");
      loadSteps();
    } catch {
      message.error("Failed to remove approver");
    }
  };

  // ---------- Final Receivers
  const handleAddFinalReceiver = () => {
    finalReceiverForm.resetFields();
    setIsFinalReceiverModalOpen(true);
  };

  const handleSaveFinalReceiver = async (values) => {
    try {
      const response = await fetch(`/api/workflows/${id}/final-receivers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(values), // { designationName, userId }
      });
      if (!response.ok) throw new Error();
      message.success("Final receiver added");
      setIsFinalReceiverModalOpen(false);
      fetchFinalReceivers();
    } catch {
      message.error("Failed to add final receiver");
    }
  };

  const handleRemoveFinalReceiver = async (receiverId) => {
    try {
      const response = await fetch(`/api/workflows/${id}/final-receivers/${receiverId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error();
      message.success("Final receiver removed");
      fetchFinalReceivers();
    } catch {
      message.error("Failed to remove final receiver");
    }
  };

  // ---------- Table columns
  const columns = [
    { title: "Step Name", dataIndex: "stepName" },
    { title: "Sequence", dataIndex: "sequence" },
    { title: "SLA (hrs)", dataIndex: "slaHours" },
    { title: "Auto Approve", dataIndex: "autoApprove", render: (v) => (v ? "Yes" : "No") },
    {
      title: "Approvers",
      render: (_, record) => (
        <>
          {record.approvers?.map((a) => {
            const u = userIndex.get(a.userId);
            const label =
              (u && `${u.fullName}${u.email ? ` (${u.email})` : ""}${u.designationName ? ` • ${u.designationName}` : ""}`) ||
              a.userName || // in case backend returns it
              `User ID: ${a.userId}`;
            return (
              <div key={a.id}>
                {label}
                <Popconfirm title="Remove approver?" onConfirm={() => handleRemoveApprover(a.id)}>
                  <Button type="link" danger size="small">Remove</Button>
                </Popconfirm>
              </div>
            );
          })}
          <Button type="link" onClick={() => handleAddApprover(record.stepId)}>+ Add Approver</Button>
        </>
      ),
    },
    {
      title: "Actions",
      render: (_, record) => (
        <Popconfirm title="Delete this step?" onConfirm={() => handleDeleteStep(record.stepId)}>
          <Button type="link" danger>Delete</Button>
        </Popconfirm>
      ),
    },
  ];

  // ---------- Option label helper
  const optionLabel = (u) =>
    `${u.fullName}${u.email ? ` (${u.email})` : ""}${u.designationName ? ` • ${u.designationName}` : ""}`;

  return (
    <div>
      <Button type="primary" onClick={handleAddStep} style={{ marginBottom: 16 }}>
        Add Step
      </Button>
      <Table rowKey="stepId" dataSource={steps} columns={columns} loading={loading} />

      {/* Step Modal */}
      <Modal title="Add Workflow Step" open={isModalOpen} onCancel={() => setIsModalOpen(false)} footer={null}>
        <Form form={form} layout="vertical" onFinish={handleSaveStep}>
          <Form.Item name="stepName" label="Step Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="sequence" label="Sequence" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="slaHours" label="SLA (hours)">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="autoApprove" label="Auto Approve" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Button type="primary" htmlType="submit">Save</Button>
        </Form>
      </Modal>

      {/* Approver Modal */}
      <Modal title="Add Approver" open={isApproverModalOpen} onCancel={() => setIsApproverModalOpen(false)} footer={null}>
        <Form form={approverForm} layout="vertical" onFinish={handleSaveApprover}>
          <Form.Item name="userId" label="Approver" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="Search name or email…"
              optionFilterProp="label"
              filterOption={(input, option) =>
                (option?.label || "").toLowerCase().includes(input.toLowerCase())
              }
            >
              {allUsers.map((u) => (
                <Option key={u.id} value={u.id} label={optionLabel(u)}>
                  {u.fullName} <span style={{ color: "#999" }}>
                    {u.email ? `• ${u.email} ` : ""}{u.designationName ? `• ${u.designationName}` : ""}
                  </span>
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Button type="primary" htmlType="submit">Add Approver</Button>
        </Form>
      </Modal>

      {/* Final Receiver Section */}
      <div style={{ marginTop: 32 }}>
        <h3>Final Receivers</h3>
        {finalReceivers.map((r) => (
          <div key={r.id} style={{ marginBottom: 8 }}>
            {r.designationName} - {r.userName}
            <Popconfirm title="Remove final receiver?" onConfirm={() => handleRemoveFinalReceiver(r.id)}>
              <Button type="link" danger size="small">Remove</Button>
            </Popconfirm>
          </div>
        ))}
        <Button type="primary" onClick={handleAddFinalReceiver} style={{ marginTop: 8 }}>
          + Add Final Receiver
        </Button>
      </div>

      {/* Final Receiver Modal */}
      <Modal title="Add Final Receiver" open={isFinalReceiverModalOpen} onCancel={() => setIsFinalReceiverModalOpen(false)} footer={null}>
        <Form form={finalReceiverForm} layout="vertical" onFinish={handleSaveFinalReceiver}>
          <Form.Item name="designationName" label="Designation" rules={[{ required: true }]}>
            <Select onChange={fetchUsersByDesignation} showSearch optionFilterProp="label">
              {designations.map((d) => (
                <Option key={d.name} value={d.name} label={d.name}>{d.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="userId" label="User" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="Type name or email…"
              optionFilterProp="label"
              filterOption={(input, option) =>
                (option?.label || "").toLowerCase().includes(input.toLowerCase())
              }
            >
              {users.map((u) => (
                <Option key={u.id} value={u.id} label={optionLabel(u)}>
                  {u.fullName} <span style={{ color: "#999" }}>
                    {u.email ? `• ${u.email} ` : ""}{u.designationName ? `• ${u.designationName}` : ""}
                  </span>
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Button type="primary" htmlType="submit">Add Final Receiver</Button>
        </Form>
      </Modal>
    </div>
  );
}
