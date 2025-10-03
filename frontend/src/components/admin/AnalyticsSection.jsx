import React from "react";
import { Paper, Typography } from "@mui/material";

const AnalyticsSection = () => {
  return (
    <Paper elevation={3} sx={{ p: 2 }}>
      <Typography variant="h6" mb={1}>Analytics</Typography>
      <Typography variant="body2">[📈 Charts will go here]</Typography>
    </Paper>
  );
};

export default AnalyticsSection;
