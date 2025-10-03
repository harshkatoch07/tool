import React, { useEffect, useState } from "react";
import {
  Button,
  Table,
  Spin,
  Popconfirm,
  message,
  Tag,
  Tooltip,
  Segmented,
  Space,
} from "antd";
import { useNavigate } from "react-router-dom";
import {
  getAllWorkflowsAdmin,
  getAssignedWorkflows,
  deleteWorkflow,
} from "../../../api/workflowApi";
import { useAuth } from "../../../context/AuthContext";

function getRoleFromToken(token) {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1] || ""));
    return (
      payload?.role ||
      payload?.Role ||
      (Array.isArray(payload?.roles) ? payload.roles[0] : null) ||
      payload?.["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ||
      null
    );
  } catch {
    return null;
  }
}

export default function WorkflowList() {
  const { token, user } = useAuth();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const navigate = useNavigate();

  const role =
    user?.role ||
    user?.Role ||
    (Array.isArray(user?.roles) ? user.roles[0] : null) ||
    getRoleFromToken(token);

  const isAdmin = String(role || "").toLowerCase() === "admin";

  useEffect(() => {
    const loadWorkflows = async () => {
      if (!token) return;
      try {
        setLoading(true);
        const data = isAdmin
          ? await getAllWorkflowsAdmin(token) // admin sees everything
          : await getAssignedWorkflows(token); // initiatorOnly=true behind the scenes
        setWorkflows(data || []);
      } catch (error) {
        console.error(error);
        message.error("Failed to load workflows");
        setWorkflows([]);
      } finally {
        setLoading(false);
      }
    };
    loadWorkflows();
  }, [token, isAdmin]);

  const handleDelete = async (id) => {
    try {
      await deleteWorkflow(id, token);
      message.success("Workflow deleted");
      // reload
      const data = isAdmin
        ? await getAllWorkflowsAdmin(token)
        : await getAssignedWorkflows(token);
      setWorkflows(data || []);
    } catch (error) {
      message.error("Failed to delete workflow");
    }
  };

  const getSlaInDays = (slaHours) => {
    if (!slaHours || slaHours <= 0) return "-";
    return `${Math.round(slaHours / 24)} day(s)`;
  };

  const filteredWorkflows = workflows.filter((wf) => {
    if (filter === "all") return true;
    if (filter === "active") return wf.isActive;
    if (filter === "inactive") return !wf.isActive;
    return true;
  });

  const columns = [
    { title: "Name", dataIndex: "name" },
    { title: "Description", dataIndex: "description" },
    {
      title: "Department",
      dataIndex: "departmentId",
      render: (_, record) => record.departmentName || record.departmentId || "—",
    },
    { title: "Template", dataIndex: "template" },
    {
      title: "Active",
      dataIndex: "isActive",
      render: (v) => (v ? <Tag color="green">Active</Tag> : <Tag color="red">Inactive</Tag>),
    },
    {
      title: "Initiator",
      dataIndex: "initiatorFullName",
      render: (_, record) =>
        !record.initiatorFullName || record.initiatorFullName === "Not Assigned" ? (
          <span style={{ color: "#aaa" }}>Not Assigned</span>
        ) : (
          <Tooltip title={record.initiatorDesignation}>
            <Tag color="blue">{record.initiatorFullName}</Tag>
          </Tooltip>
        ),
    },
    {
      title: "Final Receivers",
      dataIndex: "finalReceivers",
      render: (receivers) =>
        receivers?.length ? (
          receivers.map((r, i) => (
            <Tooltip key={`${r.userId ?? i}-${r.designationName ?? "n/a"}`} title={r.designationName || ""}>
              <Tag color="purple">{r.designationName || "Unknown"}</Tag>
            </Tooltip>
          ))
        ) : (
          <span style={{ color: "#aaa" }}>None</span>
        ),
    },
    {
      title: "Steps & SLA (Days)",
      dataIndex: "steps",
      render: (_, record) =>
        record.steps?.length ? (
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {record.steps.map((step, idx) =>
              step.stepName === "Initiator" ? (
                <li key={idx}>
                  <b>{step.stepName}</b> ({step.designationName})
                </li>
              ) : (
                <li key={idx}>
                  <b>{step.stepName}</b> ({step.designationName}) — SLA:{" "}
                  <Tag color="geekblue">{getSlaInDays(step.slaHours)}</Tag>
                </li>
              )
            )}
          </ul>
        ) : (
          <span style={{ color: "#aaa" }}>No Steps</span>
        ),
    },
    {
      title: "Actions",
      render: (_, record) => (
        <>
          <Button type="link" onClick={() => navigate(`/admin/workflows/${record.workflowId}/edit`)}>
            Edit
          </Button>
          {isAdmin && (
            <Popconfirm title="Delete this workflow?" onConfirm={() => handleDelete(record.workflowId)}>
              <Button type="link" danger>
                Delete
              </Button>
            </Popconfirm>
          )}
        </>
      ),
    },
  ];

  if (loading)
    return <Spin size="large" style={{ display: "block", margin: "50px auto" }} />;

  return (
    <div style={{ padding: 32 }}>
      {/* Header + Actions */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <h1 style={{ marginBottom: 0 }}>Workflow List</h1>
        <Space wrap>
          {/* Import button visible only to Admins */}
          {isAdmin && (
            <Button onClick={() => navigate("/admin/workflows/import")} type="default">
              Import Workflows
            </Button>
          )}
          {/* Create button visible only to Admins */}
          {isAdmin && (
            <Button type="primary" onClick={() => navigate("/admin/workflows/new")}>
              Create Workflow
            </Button>
          )}
          <Button onClick={() => navigate("/admin")} type="default">
            Close
          </Button>
        </Space>
      </div>

      <Segmented
        style={{ marginBottom: 16 }}
        options={[
          { label: "All", value: "all" },
          { label: "Active", value: "active" },
          { label: "Inactive", value: "inactive" },
        ]}
        value={filter}
        onChange={setFilter}
      />

      <Table
        rowKey="workflowId"
        dataSource={filteredWorkflows}
        columns={columns}
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
}
