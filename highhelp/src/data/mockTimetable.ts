export const BELL_TIMES = [
    { period: "0", startTime: "08:00", endTime: "08:50", label: "Period 0" },
    { period: "RC", startTime: "08:50", endTime: "08:57", label: "Roll Call" },
    { period: "1", startTime: "09:00", endTime: "10:00", label: "Period 1" },
    { period: "2", startTime: "10:05", endTime: "11:05", label: "Period 2" },
    { period: "R", startTime: "11:05", endTime: "11:22", label: "Recess" },
    { period: "3", startTime: "11:25", endTime: "12:25", label: "Period 3" },
    { period: "L1", startTime: "12:25", endTime: "12:45", label: "Lunch 1" },
    { period: "L2", startTime: "12:45", endTime: "13:02", label: "Lunch 2" },
    { period: "4", startTime: "13:05", endTime: "14:05", label: "Period 4" },
    { period: "5", startTime: "14:10", endTime: "15:10", label: "Period 5" },
    { period: "EoD", startTime: "15:10", endTime: "23:59", label: "End of Day" }
];

export const CALENDAR: Record<string, string> = {
    // Term 1 (Partial mock for Feb/March/April 2026 based on apioutput.txt pattern)
    // Week 1 A
    "2026-02-02": "1", "2026-02-03": "2", "2026-02-04": "3", "2026-02-05": "4", "2026-02-06": "5",
    // Week 2 B (Assumed pattern based on Term 1 start)
    "2026-02-09": "6", "2026-02-10": "7", "2026-02-11": "8", "2026-02-12": "9", "2026-02-13": "10",
    // Week 3 A
    "2026-02-16": "1", "2026-02-17": "2", "2026-02-18": "3", "2026-02-19": "4", "2026-02-20": "5",
    // Week 4 B
    "2026-02-23": "6", "2026-02-24": "7", "2026-02-25": "8", "2026-02-26": "9", "2026-02-27": "10",
    // Week 5 A
    "2026-03-02": "1", "2026-03-03": "2", "2026-03-04": "3", "2026-03-05": "4", "2026-03-06": "5",
    // Week 6 B
    "2026-03-09": "6", "2026-03-10": "7", "2026-03-11": "8", "2026-03-12": "9", "2026-03-13": "10",
    // Week 7 A
    "2026-03-16": "1", "2026-03-17": "2", "2026-03-18": "3", "2026-03-19": "4", "2026-03-20": "5",
    // Week 8 B
    "2026-03-23": "6", "2026-03-24": "7", "2026-03-25": "8", "2026-03-26": "9", "2026-03-27": "10",
    // Week 9 A
    "2026-03-30": "1", "2026-03-31": "2", "2026-04-01": "3", "2026-04-02": "4",
};

export interface PeriodData {
    title: string;
    teacher: string | null;
    room: string | null;
    year: string | null;
    fullTeacher: string;
    color?: string; // Hex code without #
    subject?: string;
}

export interface DayTimetable {
    dayname: string;
    rollcall: PeriodData;
    periods: Record<string, PeriodData>;
}

export const TIMETABLE_DATA: Record<string, DayTimetable> = {
    "1": {
        dayname: "MonA",
        rollcall: { title: "RC 11R", teacher: "WANR", room: null, year: null, fullTeacher: "R Wang", color: "000000" },
        periods: {
            "1": { title: "11 English Advanced I5", teacher: "MELR", room: "203", year: "11", fullTeacher: "R Mellor", color: "ffd718", subject: "English Advanced Yr11" },
            "2": { title: "11 Business Studies (HSC Accelerated) 3", teacher: "HIGS", room: "507", year: "11", fullTeacher: "S Higgins", color: "008080", subject: "Business Studies (HSC Accelerated) Yr11" },
            "3": { title: "11 Software Engineering 4", teacher: "COMD", room: "802", year: "11", fullTeacher: "D Comben", color: "448ae6", subject: "Software Engineering Yr11" },
            "4": { title: "11 Physics 1", teacher: "HOOM", room: "304", year: "11", fullTeacher: "M Hood", color: "2ee8d7", subject: "Physics Yr11" },
            "5": { title: "11 Mathematics Extension 1 A6", teacher: "FULA", room: "102", year: "11", fullTeacher: "A Fuller", color: "dc5221", subject: "Mathematics Extension 1 Yr11" }
        }
    },
    "2": {
        dayname: "TueA",
        rollcall: { title: "RC 11R", teacher: "WANR", room: null, year: null, fullTeacher: "R Wang", color: "000000" },
        periods: {
            "1": { title: "11 English Extension 1 D6", teacher: "CURJ", room: "401", year: "11", fullTeacher: "J Curry", color: "ffd718", subject: "English Extension 1 Yr11" },
            "2": { title: "11 English Advanced I5", teacher: "BOUL", room: "203", year: "11", fullTeacher: "L Boulle", color: "ffd718", subject: "English Advanced Yr11" },
            "3": { title: "11 Physics 1", teacher: "HOOM", room: "304", year: "11", fullTeacher: "M Hood", color: "2ee8d7", subject: "Physics Yr11" },
            "4": { title: "11 Business Studies (HSC Accelerated) 3", teacher: "HIGS", room: "507", year: "11", fullTeacher: "S Higgins", color: "008080", subject: "Business Studies (HSC Accelerated) Yr11" },
            "5": { title: "11 Software Engineering 4", teacher: "COMD", room: "802", year: "11", fullTeacher: "D Comben", color: "448ae6", subject: "Software Engineering Yr11" }
        }
    },
    "3": {
        dayname: "WedA",
        rollcall: { title: "RC 11R", teacher: "WANR", room: null, year: null, fullTeacher: "R Wang", color: "000000" },
        periods: {
            "1": { title: "11 Business Studies (HSC Accelerated) 3", teacher: "HIGS", room: "507", year: "11", fullTeacher: "S Higgins", color: "008080", subject: "Business Studies (HSC Accelerated) Yr11" },
            "2": { title: "11 Mathematics Advanced A2", teacher: "FULA", room: "102", year: "11", fullTeacher: "A Fuller", color: "dc5221", subject: "Mathematics Advanced Yr11" },
            "3": { title: "11 Software Engineering 4", teacher: "COMD", room: "802", year: "11", fullTeacher: "D Comben", color: "448ae6", subject: "Software Engineering Yr11" },
            "4": { title: "11 Sport 11", teacher: null, room: null, year: "11", fullTeacher: "", color: "7f5252", subject: "Sport Yr11" },
            "5": { title: "11 Sport 11", teacher: null, room: null, year: "11", fullTeacher: "", color: "7f5252", subject: "Sport Yr11" }
        }
    },
    "4": {
        dayname: "ThuA",
        rollcall: { title: "RC 11R", teacher: "WANR", room: null, year: null, fullTeacher: "R Wang", color: "000000" },
        periods: {
            "1": { title: "11 Software Engineering 4", teacher: "COMD", room: "802", year: "11", fullTeacher: "D Comben", color: "448ae6", subject: "Software Engineering Yr11" },
            "2": { title: "11 Mathematics Advanced A2", teacher: "FULA", room: "102", year: "11", fullTeacher: "A Fuller", color: "dc5221", subject: "Mathematics Advanced Yr11" },
            "3": { title: "11 English Advanced I5", teacher: "BOUL", room: "203", year: "11", fullTeacher: "L Boulle", color: "ffd718", subject: "English Advanced Yr11" },
            "4": { title: "11 Mathematics Extension 1 A6", teacher: "FULA", room: "102", year: "11", fullTeacher: "A Fuller", color: "dc5221", subject: "Mathematics Extension 1 Yr11" }
        }
    },
    "5": {
        dayname: "FriA",
        rollcall: { title: "RC 11R", teacher: "WANR", room: null, year: null, fullTeacher: "R Wang", color: "000000" },
        periods: {
            "1": { title: "11 English Advanced I5", teacher: "BOUL", room: "203", year: "11", fullTeacher: "L Boulle", color: "ffd718", subject: "English Advanced Yr11" },
            "2": { title: "11 Business Studies (HSC Accelerated) 3", teacher: "HIGS", room: "507", year: "11", fullTeacher: "S Higgins", color: "008080", subject: "Business Studies (HSC Accelerated) Yr11" },
            "3": { title: "11 English Extension 1 D6", teacher: "CURJ", room: "401", year: "11", fullTeacher: "J Curry", color: "ffd718", subject: "English Extension 1 Yr11" },
            "4": { title: "11 Physics 1", teacher: "HOOM", room: "304", year: "11", fullTeacher: "M Hood", color: "2ee8d7", subject: "Physics Yr11" },
            "5": { title: "11 Mathematics Advanced A2", teacher: "FULA", room: "102", year: "11", fullTeacher: "A Fuller", color: "dc5221", subject: "Mathematics Advanced Yr11" }
        }
    },
    "6": {
        dayname: "MonB",
        rollcall: { title: "RC 11R", teacher: "WANR", room: null, year: null, fullTeacher: "R Wang", color: "000000" },
        periods: {
            "1": { title: "11 Mathematics Advanced A2", teacher: "FULA", room: "102", year: "11", fullTeacher: "A Fuller", color: "dc5221", subject: "Mathematics Advanced Yr11" },
            "2": { title: "11 Physics 1", teacher: "HOOM", room: "304", year: "11", fullTeacher: "M Hood", color: "2ee8d7", subject: "Physics Yr11" },
            "3": { title: "11 Business Studies (HSC Accelerated) 3", teacher: "HIGS", room: "507", year: "11", fullTeacher: "S Higgins", color: "008080", subject: "Business Studies (HSC Accelerated) Yr11" },
            "4": { title: "11 English Advanced I5", teacher: "MELR", room: "203", year: "11", fullTeacher: "R Mellor", color: "ffd718", subject: "English Advanced Yr11" },
            "5": { title: "11 Mathematics Extension 1 A6", teacher: "FULA", room: "102", year: "11", fullTeacher: "A Fuller", color: "dc5221", subject: "Mathematics Extension 1 Yr11" }
        }
    },
    "7": {
        dayname: "TueB",
        rollcall: { title: "RC 11R", teacher: "WANR", room: null, year: null, fullTeacher: "R Wang", color: "000000" },
        periods: {
            "0": { title: "11 Mathematics Extension 1 A6", teacher: "FULA", room: "102", year: "11", fullTeacher: "A Fuller", color: "dc5221", subject: "Mathematics Extension 1 Yr11" },
            "1": { title: "11 Software Engineering 4", teacher: "COMD", room: "802", year: "11", fullTeacher: "D Comben", color: "448ae6", subject: "Software Engineering Yr11" },
            "2": { title: "11 Physics 1", teacher: "HOOM", room: "304", year: "11", fullTeacher: "M Hood", color: "2ee8d7", subject: "Physics Yr11" },
            "3": { title: "11 English Extension 1 D6", teacher: "CURJ", room: "401", year: "11", fullTeacher: "J Curry", color: "ffd718", subject: "English Extension 1 Yr11" },
            "4": { title: "11 English Advanced I5", teacher: "BOUL", room: "203", year: "11", fullTeacher: "L Boulle", color: "ffd718", subject: "English Advanced Yr11" },
            "5": { title: "11 Meetings A", teacher: "IBBK", room: null, year: "11", fullTeacher: "K Ibbott", color: "c0c0c0", subject: "Meetings Yr11" }
        }
    },
    "8": {
        dayname: "WedB",
        rollcall: { title: "RC 11R", teacher: "WANR", room: null, year: null, fullTeacher: "R Wang", color: "000000" },
        periods: {
            "1": { title: "11 Business Studies (HSC Accelerated) 3", teacher: "HIGS", room: "507", year: "11", fullTeacher: "S Higgins", color: "008080", subject: "Business Studies (HSC Accelerated) Yr11" },
            "2": { title: "11 Mathematics Advanced A2", teacher: "FULA", room: "102", year: "11", fullTeacher: "A Fuller", color: "dc5221", subject: "Mathematics Advanced Yr11" },
            "3": { title: "11 Software Engineering 4", teacher: "COMD", room: "802", year: "11", fullTeacher: "D Comben", color: "448ae6", subject: "Software Engineering Yr11" },
            "4": { title: "11 Sport 11", teacher: null, room: null, year: "11", fullTeacher: "", color: "7f5252", subject: "Sport Yr11" },
            "5": { title: "11 Sport 11", teacher: null, room: null, year: "11", fullTeacher: "", color: "7f5252", subject: "Sport Yr11" }
        }
    },
    "9": {
        dayname: "ThuB",
        rollcall: { title: "RC 11R", teacher: "WANR", room: null, year: null, fullTeacher: "R Wang", color: "000000" },
        periods: {
            "1": { title: "11 Physics 1", teacher: "HOOM", room: "304", year: "11", fullTeacher: "M Hood", color: "2ee8d7", subject: "Physics Yr11" },
            "2": { title: "11 Software Engineering 4", teacher: "COMD", room: "802", year: "11", fullTeacher: "D Comben", color: "448ae6", subject: "Software Engineering Yr11" },
            "3": { title: "11 Mathematics Advanced A2", teacher: "FULA", room: "102", year: "11", fullTeacher: "A Fuller", color: "dc5221", subject: "Mathematics Advanced Yr11" },
            "4": { title: "11 Mathematics Extension 1 A6", teacher: "FULA", room: "102", year: "11", fullTeacher: "A Fuller", color: "dc5221", subject: "Mathematics Extension 1 Yr11" }
        }
    },
    "10": {
        dayname: "FriB",
        rollcall: { title: "RC 11R", teacher: "WANR", room: null, year: null, fullTeacher: "R Wang", color: "000000" },
        periods: {
            "1": { title: "11 Mathematics Advanced A2", teacher: "FULA", room: "102", year: "11", fullTeacher: "A Fuller", color: "dc5221", subject: "Mathematics Advanced Yr11" },
            "2": { title: "11 Physics 1", teacher: "HOOM", room: "304", year: "11", fullTeacher: "M Hood", color: "2ee8d7", subject: "Physics Yr11" },
            "3": { title: "11 English Extension 1 D6", teacher: "CURJ", room: "401", year: "11", fullTeacher: "J Curry", color: "ffd718", subject: "English Extension 1 Yr11" },
            "4": { title: "11 Business Studies (HSC Accelerated) 3", teacher: "HIGS", room: "507", year: "11", fullTeacher: "S Higgins", color: "008080", subject: "Business Studies (HSC Accelerated) Yr11" },
            "5": { title: "11 English Advanced I5", teacher: "BOUL", room: "203", year: "11", fullTeacher: "L Boulle", color: "ffd718", subject: "English Advanced Yr11" }
        }
    }
};
