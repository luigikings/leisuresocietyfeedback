// CONTENT DATA — the only file to edit to change countries or questions.
// Bump `version` whenever countries or questions change (old progress is discarded, RF-52).
// Flags: assets/flags/<iso code in lowercase>.svg. Option types: "normal" | "open-required" | "open-optional".
// Real countries of the event (2026-10-18); more can be added later (bump `version`).

export const CONTENT = {
  version: "2026-10-live-2", // live-2: Q3 became multiple choice (RF-166)

  // Shown in this order (RF-3, RF-10); "Other" is added last by the interface.
  countries: [
    { code: "NL", name: "Netherlands" },
    { code: "HU", name: "Hungary" },
    { code: "VE", name: "Venezuela" },
    { code: "IT", name: "Italy" },
    { code: "RO", name: "Romania" },
    { code: "PL", name: "Poland" },
  ],

  questions: [
    {
      id: "q1",
      site: "park",
      text: "Was there a moment when you stopped thinking about work, study or daily worries? What caused it?",
      options: [
        { letter: "A", label: "I stopped thinking and felt truly in the moment.", type: "normal" },
        { letter: "B", label: "I couldn't fully detach.", type: "normal" },
      ],
    },
    {
      id: "q2",
      site: "concert-hall",
      text: "Which part of the event made you feel most at ease or most energized?",
      options: [
        { letter: "A", label: "Tell us…", type: "open-required" },
        { letter: "B", label: "Nothing really had that effect on me.", type: "normal" },
      ],
    },
    {
      id: "q3",
      site: "museum",
      text: "Did the event feel meaningful to you? In what way?",
      multiple: true, // 1 to 3 options, saved as "A", "AC", "ABC"… (RF-154, RF-164). Only q3 may be multiple.
      options: [
        { letter: "A", label: "The theme", type: "normal" },
        { letter: "B", label: "The people", type: "normal" },
        { letter: "C", label: "A message", type: "normal" },
      ],
    },
    {
      id: "q4",
      site: "theatre",
      text: "Did the event reach you in a way that other leisure activities don't?",
      options: [
        { letter: "A", label: "It was different than I'm used to.", type: "normal" },
        { letter: "B", label: "It didn't reach me differently.", type: "normal" },
      ],
    },
    {
      id: "q5",
      site: "cinema",
      text: "Which moment will you remember or tell others about?",
      options: [
        { letter: "A", label: "Tell us…", type: "open-required" },
        { letter: "B", label: "I won't remember this event.", type: "normal" },
      ],
    },
    {
      id: "q6",
      site: "fairground",
      text: "Did the atmosphere, location and set-up create a world of its own, or did it feel like just a gathering?",
      options: [
        { letter: "A", label: "The set-up helped create its own atmosphere", type: "normal" },
        { letter: "B", label: "It felt like a regular gathering", type: "normal" },
      ],
    },
    {
      id: "q7",
      site: "town-square",
      text: "Do you think events like this matter for society, for example for social cohesion, wellbeing or local community?",
      options: [
        { letter: "A", label: "Social cohesion/wellbeing/local community", type: "normal" },
        { letter: "B", label: "They don't matter", type: "normal" },
      ],
    },
    {
      id: "q8",
      site: "food-market",
      text: "Did you notice sustainability choices (food, materials, waste)? Did they affect how you felt about the event?",
      options: [
        { letter: "A", label: "I was happy to see them", type: "normal" },
        { letter: "B", label: "I didn't notice or there were no sustainability choices", type: "normal" },
      ],
    },
    {
      id: "q9",
      site: "nightclub",
      text: "Was the flow clear and the atmosphere consistent? Did anything feel out of place?",
      options: [
        { letter: "A", label: "Nothing felt out of place", type: "normal" },
        { letter: "B", label: "Something was a bit messy", type: "open-optional" },
      ],
    },
    {
      id: "q10",
      site: "stadium",
      text: "Did anything practical (sound, queues, signage, timing) bother you during the event?",
      options: [
        { letter: "A", label: "They didn't bother me at all", type: "normal" },
        { letter: "B", label: "Something bothered me", type: "open-optional" },
      ],
    },
  ],
};
