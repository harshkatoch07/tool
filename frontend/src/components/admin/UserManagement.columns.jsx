import React from "react";

export const userMgmtColumns = [
  { field: "userId", headerName: "ID", minWidth: 80 },
  { field: "fullName", headerName: "Name", minWidth: 200 },
  { field: "email", headerName: "Email", minWidth: 240 },
  { field: "username", headerName: "Username", minWidth: 160 },
  { field: "roleName", headerName: "Role", minWidth: 140 },
  { field: "designationName", headerName: "Designation", minWidth: 180 },
  {
    field: "isActive",
    headerName: "Active",
    minWidth: 110,
    render: (r) => (r.isActive ? "Yes" : "No"),
    valueGetter: (r) => r.isActive,
  },
];
