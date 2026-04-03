const generateHistoricalData = () => {
  const sessions = [];
  const visitedDays = [];
  let tasksPlanned = 45;
  let tasksDone = 32;

  const today = new Date();
  today.setHours(14, 0, 0, 0); // Anchor to an afternoon time

  // Generate 28 days of history
  for (let i = 28; i >= 0; i--) {
    const currentDay = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const dayOfWeek = currentDay.getDay();
    
    // Skip some days (e.g. some Sundays or random off days) to make charts organic
    if (i !== 0 && (dayOfWeek === 0 || i % 9 === 0)) continue;
    
    visitedDays.push(currentDay.toDateString());
    
    // Vary pomodoros heavily per day (from 2 to 10) deterministically based on date index
    // Force today (i===0) to have lots of pomodoros spread across the day
    const pomodorosToday = i === 0 ? 14 : (2 + (i % 5) + (dayOfWeek === 1 ? 3 : 0)); 
    
    for (let p = 0; p < pomodorosToday; p++) {
      // For today, spread sessions across the entire 24h period so the time-of-day chart fills up!
      let sessionEnd;
      let dynamicDuration = 1500;
      
      if (i === 0) {
        // Spread 14 pomodoros nicely across early morning, morning, afternoon, and evening
        sessionEnd = new Date(currentDay.getFullYear(), currentDay.getMonth(), currentDay.getDate(), 1 + (p * 1.5), 15 * (p % 4), 0);
        // Make duration dynamic between 15 and 45 minutes for today
        const minutes = 15 + ((p * 7) % 30);
        dynamicDuration = minutes * 60;
      } else {
        sessionEnd = new Date(currentDay.getTime() - (8 - p) * 45 * 60 * 1000); 
      }
      
      const tasksList = [
        { id: "seed-task-1", title: "Welcome to Pomodoro!", color: "red" },
        { id: "seed-task-2", title: "Plan the weekend trip", color: "yellow" },
        { id: "seed-task-6", title: "Draft architecture technical spec", color: "purple" },
        { id: "seed-task-3", title: "Clean out the inbox", color: "blue" }
      ];

      // Cluster sessions for the same task together organically
      let tIndex = Math.floor(p / 3) % tasksList.length;
      let taskObj = tasksList[tIndex];

      sessions.push({
        mode: "pomodoro",
        completed: true,
        duration: dynamicDuration, 
        pauseCount: p % 4 === 0 ? 1 : 0,
        completedAt: sessionEnd.toISOString(),
        taskTitle: taskObj.title,
        taskId: taskObj.id
      });
      
      // Add breaks
      const breakMode = (p + 1) % 4 === 0 ? "long" : "short";
      const breakDuration = breakMode === "long" ? 900 : 300;
      const breakEnd = new Date(sessionEnd.getTime() + breakDuration * 1000);
      
      sessions.push({
        mode: breakMode,
        completed: true,
        duration: breakDuration,
        pauseCount: 0,
        completedAt: breakEnd.toISOString(),
        taskTitle: "Break",
        taskId: null
      });
    }
  }
  
  return { sessions, visitedDays, tasksPlanned, tasksDone };
};

const histData = generateHistoricalData();

export const guestAccount = {
  name: "guest",
  settings: {
    pomodoroMinutes: "25",
    shortBreakMinutes: "5",
    longBreakMinutes: "15",
    usePomodoroSequence: "true",
    endlessMode: "false",
    soundsAlertSound: "Lofi",
    playSoundWhenTimerFinish: "true",
    alertVolume: "50",
    customSounds: "{}",
    endTimerNotification: "true"
  },
  tasks: [
    {
      id: "seed-task-1",
      title: "Welcome to Pomodoro!",
      color: "red",
      pomodorosPlanned: 4,
      pomodorosDone: 1,
      dueDate: new Date().toISOString().split("T")[0],
      mode: "pomodoro",
      notes: "This is a priority task. I've already done 1 pomodoro on it.",
      priority: 1,
      completed: false,
      createdAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
      id: "seed-task-2",
      title: "Plan the weekend trip",
      color: "yellow",
      pomodorosPlanned: 2,
      pomodorosDone: 0,
      dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
      mode: "pomodoro",
      notes: "Look up AirBnBs and hiking routes.",
      priority: 2,
      completed: false,
      createdAt: new Date().toISOString()
    },
    {
      id: "seed-task-3",
      title: "Clean out the inbox",
      color: "blue",
      pomodorosPlanned: 1,
      pomodorosDone: 1,
      dueDate: new Date(Date.now() - 86400000 * 2).toISOString().split("T")[0],
      mode: "pomodoro",
      notes: "Finally hitting inbox zero.",
      priority: 3,
      completed: true,
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString()
    },
    {
      id: "seed-task-4",
      title: "Read Chapter 5 of the book",
      color: "green",
      pomodorosPlanned: 3,
      pomodorosDone: 0,
      dueDate: new Date().toISOString().split("T")[0],
      mode: "free",
      notes: "Read without strict timer rules if needed.",
      priority: 4,
      completed: false,
      createdAt: new Date().toISOString()
    },
    {
      id: "seed-task-5",
      title: "File quarterly taxes",
      color: "red",
      pomodorosPlanned: 5,
      pomodorosDone: 5,
      dueDate: new Date(Date.now() - 86400000 * 5).toISOString().split("T")[0],
      mode: "pomodoro",
      notes: "Submitted via accountant email.",
      priority: 1,
      completed: true,
      createdAt: new Date(Date.now() - 86400000 * 20).toISOString()
    },
    {
      id: "seed-task-6",
      title: "Draft architecture technical spec",
      color: "purple",
      pomodorosPlanned: 8,
      pomodorosDone: 3,
      dueDate: new Date(Date.now() + 86400000 * 5).toISOString().split("T")[0],
      mode: "pomodoro",
      notes: "Include the new caching layer diagrams.",
      priority: 2,
      completed: false,
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: "seed-task-7",
      title: "Exercise - 30m cardio",
      color: "green",
      pomodorosPlanned: 1,
      pomodorosDone: 1,
      dueDate: new Date().toISOString().split("T")[0],
      mode: "free",
      notes: "Ran on treadmill.",
      priority: 3,
      completed: true,
      createdAt: new Date(Date.now() - 3600000).toISOString()
    }
  ],
  focusTask: {
    id: "seed-task-1",
    title: "Welcome to Pomodoro!",
    mode: "pomodoro"
  },
  stats: {
    tasksPlanned: histData.tasksPlanned,
    tasksDone: histData.tasksDone,
    visitedDays: histData.visitedDays,
    streak: 15,
    highestStreak: 21,
    lastActiveDate: new Date().toDateString(),
    sessions: histData.sessions
  },
  streak: {
    count: 15,
    lastDate: new Date().toDateString()
  },
  flagLabels: {
    red: "Urgent",
    yellow: "Medium",
    blue: "Low",
    green: "Optional",
    purple: "Later"
  },
  pomodoroState: {
    timePassed: 0,
    sessionIndex: 0,
    completedInCycle: 0,
    pauseCount: 0,
    savedAt: new Date().toISOString()
  }
};

export function seedGuestAccount(force = false) {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    // When run via Node.js
    console.log("==== Pomodoro Guest Account Seed Data ====\n");
    console.log(JSON.stringify([guestAccount], null, 2));
    console.log("\nTo seed manually, you can paste this JSON into your browser's localStorage under the 'accounts' key.");
    console.log(`Command:\nlocalStorage.setItem('accounts', JSON.stringify([/* data */]));`);
    console.log("localStorage.setItem('currentAccount', 'guest');");
    return guestAccount;
  }

  // When run in the browser
  const currentAccount = localStorage.getItem("currentAccount");
  const accountsData = localStorage.getItem("accounts");

  if (force || !currentAccount || !accountsData) {
    localStorage.setItem("currentAccount", "guest");
    localStorage.setItem("accounts", JSON.stringify([guestAccount]));
    console.log("Guest account seeded successfully into localStorage!");
  } else {
    console.log("Accounts already exist in localStorage. Normal dev mode skipped seeding.");
  }
}

// Determine environment and decide if we conditionally seed under dev:seed mode
const isNodeEnv = typeof window === "undefined";
const isViteSeedMode = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.MODE === "seed";

if (isNodeEnv) {
  // If explicitly requested via `npm run seed` in Node
  seedGuestAccount();
} else if (isViteSeedMode) {
  // If started with `npm run dev:seed`, clear and force seed!
  console.log("== Running in 'dev:seed' mode, overwriting user data with fresh seed... ==");
  seedGuestAccount(true);
}
