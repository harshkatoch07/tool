import React, { useEffect, useState } from "react";
import {
  Paper, Tabs, Tab, Table, TableHead,
  TableRow, TableCell, TableBody
} from "@mui/material";

// GLOBAL LOG to confirm file is loaded!
console.log("LOADED ApprovalsOverview.jsx (should see this once on refresh)");

function ApprovalsOverview() {
  const [tab, setTab] = useState(0);
  const [init, setInit] = useState([]);
  const [assigned, setAssigned] = useState([]);

  useEffect(() => {
    async function fetchApprovals() {
      alert("[DEBUG ALERT] fetchApprovals called");
      try {
        const token = localStorage.getItem("token");
        console.log("[DEBUG] Using token:", token);

        // Initiated Approvals
        const resInit = await fetch(`/api/approvals?filter=initiated`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert("[DEBUG ALERT] resInit status: " + resInit.status);
        console.log("[DEBUG] resInit status:", resInit.status);

        // Assigned Approvals
        const resAssigned = await fetch(`/api/approvals?filter=assigned`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert("[DEBUG ALERT] resAssigned status: " + resAssigned.status);
        console.log("[DEBUG] resAssigned status:", resAssigned.status);

        if (!resInit.ok || !resAssigned.ok) {
          alert("[DEBUG ALERT] One of the requests failed! See console for details.");
          throw new Error("[DEBUG] Failed to fetch approvals data");
        }

        const initData = await resInit.json();
        const assignedData = await resAssigned.json();

        console.log("[DEBUG] initData:", initData);
        console.log("[DEBUG] assignedData:", assignedData);

        setInit(initData);
        setAssigned(assignedData);
      } catch (err) {
        setInit([]);
        setAssigned([]);
        alert("[DEBUG ALERT] Caught error in fetchApprovals: " + err);
        console.error("[DEBUG] ApprovalsOverview fetch error:", err);
      }
    }
    fetchApprovals();
  }, []);

  return (
    <Paper sx={{ p:2 }}>
      <Tabs value={tab} onChange={(e,v)=>setTab(v)}>
        <Tab label="Initiated" />
        <Tab label="Assigned" />
      </Tabs>
      <Table sx={{ mt:2 }}>
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Comments</TableCell>
            <TableCell>Actioned At</TableCell>
            <TableCell>Level</TableCell>
            <TableCell>FundRequestId</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {(tab === 0 ? init : assigned).map(r => (
            <TableRow key={r.id || r.Id}>
              <TableCell>{r.id || r.Id}</TableCell>
              <TableCell>{r.status || r.Status}</TableCell>
              <TableCell>{r.comments || r.Comments}</TableCell>
              <TableCell>
                {r.actionedAt
                  ? new Date(r.actionedAt).toLocaleDateString()
                  : (r.ActionedAt
                    ? new Date(r.ActionedAt).toLocaleDateString()
                    : '')}
              </TableCell>
              <TableCell>{r.level || r.Level}</TableCell>
              <TableCell>{r.fundRequestId || r.FundRequestId}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

export default ApprovalsOverview;
