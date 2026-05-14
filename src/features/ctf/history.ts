import type {
  CtfObservation,
  CtfOperation,
  CtfOperationStatus,
  CtfWorkspace,
} from "./types";

const createId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const createCtfWorkspace = (
  challengeName = "Untitled Challenge"
): CtfWorkspace => {
  const now = new Date().toISOString();

  return {
    id: createId("ctf"),
    challengeName,
    createdAt: now,
    updatedAt: now,
    notes: "",
    artifacts: [],
    observations: [],
    operations: [],
    flagCandidates: [],
  };
};

export const createCtfOperation = (operation: {
  name: string;
  inputSummary: string;
  outputSummary: string;
  status: CtfOperationStatus;
  notes: string;
  executedAt?: string;
}): CtfOperation => ({
  id: createId("op"),
  name: operation.name.trim(),
  inputSummary: operation.inputSummary.trim(),
  outputSummary: operation.outputSummary.trim(),
  executedAt: operation.executedAt ?? new Date().toISOString(),
  status: operation.status,
  notes: operation.notes.trim(),
});

export const appendCtfOperation = (
  workspace: CtfWorkspace,
  operation: CtfOperation
): CtfWorkspace => ({
  ...workspace,
  operations: [operation, ...workspace.operations],
  updatedAt: new Date().toISOString(),
});

export const updateCtfWorkspaceNotes = (
  workspace: CtfWorkspace,
  notes: string
): CtfWorkspace => ({
  ...workspace,
  notes,
  updatedAt: new Date().toISOString(),
});

export const createCtfObservation = (observation: {
  summary: string;
  detail?: string;
  sourceOperationId?: string;
  tags?: string[];
}): CtfObservation => ({
  id: createId("obs"),
  summary: observation.summary.trim(),
  detail: observation.detail?.trim(),
  sourceOperationId: observation.sourceOperationId,
  tags: observation.tags,
  createdAt: new Date().toISOString(),
});
