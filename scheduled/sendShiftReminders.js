const { processShiftReminders } = require("../others/shiftSystem.js");

module.exports = {
    name: "sendShiftReminders",
    cron: "0 15 * * *",
    enabled: true,
    async execute() {
        const { client, db } = require("../index.js");
        if (!client || !db) return;
        await processShiftReminders(client, db);
    },
};
