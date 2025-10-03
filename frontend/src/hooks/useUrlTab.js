import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

export default function useUrlTab(defaultTab = "assigned", key = "tab") {
  const [search, setSearch] = useSearchParams();
  const tab = (search.get(key) || defaultTab).toLowerCase();

  const setTab = useCallback(
    (next) => {
      const nextTab = String(next || defaultTab).toLowerCase();
      const curr = (search.get(key) || defaultTab).toLowerCase();
      if (nextTab === curr) return; // prevents loops
      const nextSearch = new URLSearchParams(search);
      nextSearch.set(key, nextTab);
      setSearch(nextSearch, { replace: true }); // no history spam
    },
    [search, setSearch, defaultTab, key]
  );

  return [tab, setTab];
}
