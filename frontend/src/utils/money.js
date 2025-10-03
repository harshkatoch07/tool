export const fmtMoney = (n) =>
  typeof n === "number"
    ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "—";
