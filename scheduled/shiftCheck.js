const { processShiftReminders } = require("../others/shiftSystem.js");

module.exports = {
    name: "shiftCheck",
    cron: "0 * * * *",
    enabled: true,
    async execute() {
        const { client, db } = require("../index.js");
        if (!client || !db) return;
        await processShiftReminders(client, db);
    },
};
