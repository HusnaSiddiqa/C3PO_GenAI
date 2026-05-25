import { createContext, useContext } from "react";

type UnsavedChangesTabData = {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (val: boolean) => void;
};

export const UnsavedChangesDataContext = createContext<UnsavedChangesTabData>({
  hasUnsavedChanges: false,
  setHasUnsavedChanges: () => {},
});

export const useUnsavedChanges = () => useContext(UnsavedChangesDataContext);
