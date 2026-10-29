import { syncLevelsInVoting } from "../../lib/levelsInVoting";
import { scheduledTask } from "../../lib/tasks";

export default scheduledTask({
    name: "updateLevels",
    schedule: "0 0 */6 * * *",
    execute: syncLevelsInVoting
});
