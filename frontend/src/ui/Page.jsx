import React from "react";
import { Box, Container, Typography, Tabs, Tab } from "@mui/material";
import { pageGradient, softShadow } from "./theme";

export default function Page({ title, stats = [], tabs = [], actions, children, tabValue, onTabChange }) {
  return (
    <Box>
      {/* Gradient Header */}
      <Box sx={{ ...pageGradient(), pt: 4, pb: 6 }}>
        <Container maxWidth="xl">
          <Typography variant="h4" sx={{ mb: 3 }}>{title}</Typography>
          {/* Stats slot */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
            {stats}
          </Box>
        </Container>
      </Box>

      {/* Tabs + Actions */}
      {(tabs.length > 0 || actions) && (
        <Container maxWidth="xl" sx={{ mt: -4 }}>
          <Box
            sx={{
              p: 1,
              borderRadius: 2,
              boxShadow: softShadow,
              backgroundColor: "background.paper",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {tabs.length > 0 && (
              <Tabs
                value={tabValue ?? (tabs[0]?.value ?? 0)}
                onChange={onTabChange}
                sx={{ minHeight: 44 }}
              >
                {tabs.map((t, i) => (
                  <Tab key={i} label={t.label} value={t.value ?? i} />
                ))}
              </Tabs>
            )}
            <Box>{actions}</Box>
          </Box>
        </Container>
      )}

      {/* Body */}
      <Container maxWidth="xl" sx={{ py: 3 }}>
        {children}
      </Container>
    </Box>
  );
}
