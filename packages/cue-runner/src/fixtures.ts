export const cueFixtures = {
  validSpec: `package demo

service: {
  name: "example"
  replicas: 3
  ports: [80, 443]
}
`,
  conflictingFields: `package demo

value: {
  foo: string
  foo: int
}
`,
  syntaxError: `package demo

value: {
  foo: string,
}
`,
  constraintViolation: `package demo

value: {
  name: =~"[0-9]+"
}

value: {
  name: "abc"
}
`,
} as const;

export type CueFixtureKey = keyof typeof cueFixtures;
