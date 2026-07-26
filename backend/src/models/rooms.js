export const rooms = {
    "ABC123": {
        host: null,
        started: false,
        phase: "waiting",
        phaseEndTime: null,
        timer: null,
        day: 0,
        players: [],
        chat: {
            public: [],
            werewolf: [],
        },
        votes: {
            public: {},
            werewolf: {},
        },
        nightActions: {
            werewolfTarget: null,
            knightProtect: null,
            seerTarget: null,
        },
        actionTracker: {
            night: {},
            voting: {},
        },
    }
};
