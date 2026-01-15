import type { MacroDef } from "@shared/types/remapConfig";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useIpc } from "@/hooks/api/useIpc";

export function useMacros() {
  const [macros, setMacros] = useState<MacroDef[]>([]);
  const { invoke, send } = useIpc();

  // Navigation State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const fetchMacros = useCallback(async () => {
    const result = await invoke<MacroDef[]>("get-macros");
    if (result) {
      setMacros(result);
    }
  }, [invoke]);

  const saveMacros = useCallback(
    (newMacros: MacroDef[]) => {
      send("save-macros", { macros: newMacros });
      setMacros(newMacros);
    },
    [send]
  );

  useEffect(() => {
    fetchMacros();
  }, [fetchMacros]);

  // Handlers
  const onAdd = useCallback(() => {
    setEditingId(null);
    setIsAddingNew(true);
  }, []);

  const onEdit = useCallback((id: string) => {
    setEditingId(id);
    setIsAddingNew(false);
  }, []);

  const onSave = useCallback(
    (macro: MacroDef) => {
      if (editingId) {
        saveMacros(macros.map((m) => (m.id === editingId ? macro : m)));
      } else {
        saveMacros([...macros, macro]);
        setEditingId(macro.id);
      }
      setIsAddingNew(false);
    },
    [editingId, macros, saveMacros]
  );

  const onCancel = useCallback(() => {
    setEditingId(null);
    setIsAddingNew(false);
  }, []);

  const onDelete = useCallback((id: string) => {
    setDeleteTargetId(id);
  }, []);

  const executeDelete = useCallback(() => {
    if (!deleteTargetId) {
      return;
    }
    const newMacros = macros.filter((m) => m.id !== deleteTargetId);
    saveMacros(newMacros);
    if (editingId === deleteTargetId) {
      setEditingId(null);
    }
    setDeleteTargetId(null);
  }, [deleteTargetId, macros, saveMacros, editingId]);

  const onDuplicate = useCallback(
    (id: string) => {
      const target = macros.find((m) => m.id === id);
      if (target) {
        const newMacro = {
          ...target,
          id: crypto.randomUUID(),
          name: `${target.name} (Copy)`,
        };
        saveMacros([...macros, newMacro]);
        setEditingId(newMacro.id);
      }
    },
    [macros, saveMacros]
  );

  const selectedMacro = isAddingNew
    ? undefined
    : macros.find((m) => m.id === editingId);

  const deleteTargetName = useMemo(
    () => macros.find((m) => m.id === deleteTargetId)?.name,
    [macros, deleteTargetId]
  );

  return {
    macros,
    editingId,
    isAddingNew,
    deleteTargetId,
    deleteTargetName,
    selectedMacro,
    setDeleteTargetId,
    handlers: {
      onAdd,
      onEdit,
      onSave,
      onCancel,
      onDelete,
      executeDelete,
      onDuplicate,
    },
  };
}
