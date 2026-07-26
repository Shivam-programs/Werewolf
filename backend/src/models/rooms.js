export const rooms = {
    ABC123: {
        host: null,

        started: false,

        phase: "waiting",

        phaseEndTime: null,

        timer: null,

        day: 0,

        players: [],

        // Chat
        publicMessages: [],
        werewolfMessages: [],

        // Voting
        publicVotes: {},
        werewolfVotes: {},

        // Night actions
        werewolfTarget: null,
        knightAction: null,
        seerAction: null,
    },
};