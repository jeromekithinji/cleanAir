import {
  DESTINATIONS,
  type Health,
  type Mode,
  type Place,
  type Scenario,
  detectPlace,
  highestLevel,
  levelForIndex,
  levelLabel,
  LEVEL_LABEL,
} from "@/data/mock"
import { CAR_KG_PER_KM } from "@/lib/impact"
import { buildRoutes, formatMinutes, tradeoffLine, routeExplanations } from "@/lib/routing"
import { greetingReply } from "@/lib/greeting"

export type ChatChip = { label: string; message: string }

export type AssistantReply = {
  text: string
  chips?: ChatChip[]
  destinationId?: string
  mode?: Mode
  health?: Partial<Health>
}

export type AssistantContext = {
  start: Place
  mode: Mode
  health: Health
  scenario: Scenario
  airKnown: boolean
  explanations: string[]
}

const DIRECTION_PLACES = [
  "Parc La Fontaine",
  "Jean-Talon Market",
  "Atwater Market",
  "McGill University",
  "Old Port",
]

const EXAMPLE = 'Try "bike to Atwater Market this afternoon".'

export function answerMessage(raw: string, ctx: AssistantContext): AssistantReply {
  const text = raw.trim()
  const q = text.toLowerCase()
  const greeting = greetingReply(text)
  if (greeting) {
    return { text: greeting }
  }

  if (isPhrase(q, ["get directions"])) {
    return {
      text: 'Sure. Where to? Pick a place or type it, for example "bike to Atwater Market this afternoon".',
      chips: DIRECTION_PLACES.map((label) => ({
        label,
        message: `Directions to ${label}`,
      })),
    }
  }
  if (isPhrase(q, ["check conditions", "conditions"])) {
    return { text: conditionsText(ctx) }
  }
  if (isPhrase(q, ["find somewhere to go", "somewhere to go", "where should I go"])) {
    return suggestPlaces(ctx)
  }

  const destination = detectPlace(text)
  const healthPatch = healthPatchFor(q, ctx.health)
  const nextHealth = { ...ctx.health, ...healthPatch }
  const mode = modeFor(q, ctx.mode)

  if (destination) {
    const routes = buildRoutes(
      ctx.start,
      destination,
      mode,
      highestLevel(nextHealth),
      levelForIndex(ctx.scenario.index) === "poor",
    )
    const lines: string[] = []
    if (routes) {
      lines.push(
        `Cleaner air: ${formatMinutes(routes.clean.minutes)}. Fastest: ${formatMinutes(routes.fast.minutes)}.${tradeoffLine(routes.fast, routes.clean)}`,
      )
    } else {
      lines.push("Pick a different start and destination.")
    }
    lines.push(...healthSetLines(healthPatch))
    lines.push(liveAirLine(ctx))
    return {
      text: lines.join("\n"),
      destinationId: destination.id,
      mode,
      health: Object.keys(healthPatch).length ? healthPatch : undefined,
    }
  }

  if (/\bwhy\b/.test(q)) {
    if (ctx.explanations.length === 0) {
      return { text: "Plan a trip first and I can explain the route." }
    }
    return { text: ctx.explanations.map((line) => `• ${line}`).join("\n") }
  }

  if (/\b(co2|co₂|carbon|emission)\b/.test(q)) {
    return {
      text: `We compare your trip with driving the same distance, using ${CAR_KG_PER_KM} kg CO₂ per km. Walking and biking produce no tailpipe emissions.`,
    }
  }

  if (/\b(air quality|aqi|air now|pollution|how is the air|how's the air)\b/.test(q)) {
    return { text: conditionsText(ctx) }
  }

  const setLines = healthSetLines(healthPatch)
  if (setLines.length > 0) {
    return {
      text: [...setLines, EXAMPLE].join("\n"),
      health: healthPatch,
    }
  }

  return { text: EXAMPLE }
}

function healthSetLines(patch: Partial<Health>): string[] {
  const lines: string[] = []
  for (const key of ["asthma", "copd", "heat"] as const) {
    if (patch[key]) {
      const name = key === "asthma" ? "Asthma" : key === "copd" ? "COPD" : "Heat sensitivity"
      lines.push(`I've set ${name} to Medium. You can change that under Health info.`)
    }
  }
  return lines
}

function isPhrase(q: string, phrases: string[]): boolean {
  return phrases.some((phrase) => q === phrase || q.startsWith(`${phrase} `) || q.endsWith(` ${phrase}`))
}

function healthPatchFor(q: string, health: Health): Partial<Health> {
  const patch: Partial<Health> = {}
  if (/\basthma\b/.test(q) && !health.asthma) {
    patch.asthma = 2
  }
  if (/\bcopd\b/.test(q) && !health.copd) {
    patch.copd = 2
  }
  if (/\b(heat|hot)\b/.test(q) && !health.heat) {
    patch.heat = 2
  }
  return patch
}

function modeFor(q: string, current: Mode): Mode {
  const bike = q.search(/\b(bike|biking|bicycle|cycl\w*)\b/)
  const walk = q.search(/\b(walk|walking|on foot)\b/)
  if (bike >= 0 && walk >= 0) {
    return bike > walk ? "bike" : "walk"
  }
  if (bike >= 0) {
    return "bike"
  }
  if (walk >= 0) {
    return "walk"
  }
  return current
}

function liveAirLine(ctx: AssistantContext): string {
  if (!ctx.airKnown) {
    return "I don't have a live RSQA reading yet."
  }
  const station = ctx.scenario.stationName ?? "the nearest station"
  const level = levelLabel(levelForIndex(ctx.scenario.index)).toLowerCase()
  return `Right now the IQA is ${ctx.scenario.index} (${level}) at ${station}. Best time from the weather forecast: ${ctx.scenario.best}.`
}

function conditionsText(ctx: AssistantContext): string {
  if (!ctx.airKnown) {
    return "I don't have a live RSQA reading yet."
  }
  const { scenario, health } = ctx
  const level = levelForIndex(scenario.index)
  const station = scenario.stationName ?? "the nearest station"
  let text = `Air quality is ${levelLabel(level)} (${scenario.index}) at ${station}. Main pollutant: ${scenario.pollutant}.\n`
  text += `It's ${scenario.temp}°C`
  if (scenario.feels >= scenario.temp + 3) {
    text += `, feels like ${scenario.feels}°`
  }
  text += `, ${scenario.sky.toLowerCase()}, wind ${scenario.wind} km/h.`
  if (scenario.heatWarning) {
    text += " A heat warning is in effect."
  }
  text += `\nBest time to go: ${scenario.best.toLowerCase()}.`
  if (level === "poor") {
    text += "\nAir is poor, so consider going later or taking the metro."
  }
  const chosen = (["asthma", "copd", "heat"] as const).flatMap((key) => {
    const value = health[key]
    if (!value) {
      return []
    }
    const name = key === "asthma" ? "Asthma" : key === "copd" ? "COPD" : "Heat sensitivity"
    return [`${name} (${LEVEL_LABEL[value].toLowerCase()})`]
  })
  if (chosen.length === 0) {
    text += "\nAdd your health info and I can tailor this to you."
  } else if (highestLevel(health) >= 2 || level === "poor" || scenario.heatWarning) {
    text += `\nFor your ${chosen.join(", ")}: take the cleaner route and keep trips short.`
  } else {
    text += `\nFor your ${chosen.join(", ")}: the standard clean-air mode is fine.`
  }
  return text
}

function suggestPlaces(ctx: AssistantContext): AssistantReply {
  const level = levelForIndex(ctx.scenario.index)
  const favourShade = ctx.scenario.heatWarning || ctx.health.heat !== null
  const ranked = DESTINATIONS.filter((place) => place.id !== ctx.start.id)
    .map((place) => {
      const routes = buildRoutes(
        ctx.start,
        place,
        ctx.mode,
        highestLevel(ctx.health),
        level === "poor",
      )
      return { place, minutes: routes?.clean.minutes ?? 1 }
    })
    .sort((a, b) => {
      if (favourShade && a.place.shaded !== b.place.shaded) {
        return a.place.shaded ? -1 : 1
      }
      return a.minutes - b.minutes
    })
    .slice(0, 3)

  let text = "Here are three good picks from where you are"
  if (favourShade) {
    text += ", favouring shade because of the heat"
  }
  if (level === "poor") {
    text += ". Air is poor, so keep it short"
  }
  text += ":"
  const how = ctx.mode === "bike" ? "by bike" : "on foot"
  for (const item of ranked) {
    text += `\n• ${item.place.name}: ${item.place.description} (about ${item.minutes} min ${how})`
  }
  text += "\nTap one for directions."
  return {
    text,
    chips: ranked.map((item) => ({
      label: item.place.name,
      message: `Directions to ${item.place.name}`,
    })),
  }
}

export function explanationsFor(
  start: Place,
  destination: Place | null,
  mode: Mode,
  health: Health,
  scenario: Scenario,
): string[] {
  if (!destination) {
    return []
  }
  const routes = buildRoutes(
    start,
    destination,
    mode,
    highestLevel(health),
    levelForIndex(scenario.index) === "poor",
  )
  if (!routes) {
    return []
  }
  return routeExplanations(routes.fast, health, levelForIndex(scenario.index) === "poor")
}
