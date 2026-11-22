import { Collection } from "discord.js";
import type { ButtonHandler, ModalHandler } from "./types";
import acceptRecord from "./buttons/acceptRecord";
import commitAddBulkRecords from "./buttons/commitAddBulkRecords";
import commitAddLevel from "./buttons/commitAddLevel";
import commitLevelFromLegacy from "./buttons/commitLevelFromLegacy";
import commitLevelToLegacy from "./buttons/commitLevelToLegacy";
import commitMoveLevel from "./buttons/commitMoveLevel";
import commitRecords from "./buttons/commitRecords";
import deleteThread from "./buttons/deleteThread";
import denyBulkRecords from "./buttons/denyBulkRecords";
import denyRecord from "./buttons/denyRecord";
import removeMessage from "./buttons/removeMessage";
import denyBulkRecordsReason from "./modals/denyBulkRecordsReason";
import denyReason from "./modals/denyReason";

// Persistent components, routed by custom id from the interactionCreate event
export const buttons = new Collection<string, ButtonHandler>(
    [
        acceptRecord,
        commitAddBulkRecords,
        commitAddLevel,
        commitLevelFromLegacy,
        commitLevelToLegacy,
        commitMoveLevel,
        commitRecords,
        deleteThread,
        denyBulkRecords,
        denyRecord,
        removeMessage
    ].map((button) => [button.customId, button])
);

export const modals = new Collection<string, ModalHandler>(
    [denyBulkRecordsReason, denyReason].map((modal) => [modal.customId, modal])
);
