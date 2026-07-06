import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { runBeijingPoiImport } from "@/lib/amap/poi-importer"
import { classifyPoiRootCategory } from "@/lib/places/poi-classifier"

interface CliOptions {
  dryRun: boolean
  writeCache: boolean
  pageLimit?: number
  offset?: number
  maxPerKeyword?: number
}

function parseNumberFlag(arg: string, name: string) {
  if (!arg.startsWith(`${name}=`)) return undefined
  const value = Number(arg.slice(name.length + 1))
  return Number.isFinite(value) ? value : undefined
}

function parseArgs(argv: string[]): CliOptions {
  const writeCache = argv.includes("--write-cache")
  return {
    dryRun: !writeCache || argv.includes("--dry-run"),
    writeCache,
    pageLimit: argv.map((arg) => parseNumberFlag(arg, "--limit-pages")).find(Boolean),
    offset: argv.map((arg) => parseNumberFlag(arg, "--offset")).find(Boolean),
    maxPerKeyword: argv.map((arg) => parseNumberFlag(arg, "--max-per-keyword")).find(Boolean),
  }
}

function cleanEnvValue(value: string) {
  return value.trim().replace(/^['"]|['"]$/g, "")
}

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local")
  if (!existsSync(envPath)) return
  const content = readFileSync(envPath, "utf8")
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const index = line.indexOf("=")
    if (index <= 0) continue
    const key = line.slice(0, index).trim()
    const value = cleanEnvValue(line.slice(index + 1))
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

function sanitizeReport(result: Awaited<ReturnType<typeof runBeijingPoiImport>>, outputPath?: string) {
  const quarantineByReason = result.quarantine.reduce<Record<string, number>>((acc, item) => {
    acc[item.reason] = (acc[item.reason] || 0) + 1
    return acc
  }, {})
  const filteredNonBeijing = quarantineByReason.outside_beijing || 0
  const lowConfidenceOrUncertain = result.quarantine.filter((item) =>
    /no_supported_category_signal|confidence|missing_name/u.test(item.reason)
  ).length
  const strictCategoryViolations = result.pois.filter((poi) => {
    const classification = classifyPoiRootCategory({
      name: poi.name,
      type: poi.type,
      typecode: poi.typecode,
      address: poi.address,
    })
    return classification.rootCategory !== poi.rootCategory
  })

  return {
    ok: true,
    outputPath,
    stats: result.stats,
    requestedStats: {
      scenicCandidates: result.stats.byRoot.scenic,
      foodCandidates: result.stats.byRoot.food,
      hotelCandidates: result.stats.byRoot.hotel,
      filteredNonBeijing,
      lowConfidenceOrUncertain,
      quarantinedTotal: result.stats.quarantined,
      withImage: result.stats.withImage,
      placeholder: result.stats.noImage,
    },
    quarantineByReason,
    strictCategoryCheck: {
      passed: strictCategoryViolations.length === 0,
      violationCount: strictCategoryViolations.length,
      rule: "scenic excludes food/hotel; food excludes scenic/hotel; hotel excludes scenic/food",
      preview: strictCategoryViolations.slice(0, 12).map((poi) => ({
        rootCategory: poi.rootCategory,
        name: poi.name,
        type: poi.type,
        typecode: poi.typecode,
      })),
    },
    sampleNames: result.pois.slice(0, 8).map((poi) => ({
      rootCategory: poi.rootCategory,
      name: poi.name,
      district: poi.district,
      hasImage: Boolean(poi.imageUrl),
    })),
    quarantinePreview: result.quarantine.slice(0, 8).map((item) => ({
      keyword: item.keyword,
      requestedRoot: item.requestedRoot,
      name: item.name,
      reason: item.reason,
    })),
  }
}

async function main() {
  loadLocalEnv()
  const options = parseArgs(process.argv.slice(2))
  const result = await runBeijingPoiImport({
    dryRun: options.dryRun,
    pageLimit: options.pageLimit,
    offset: options.offset,
    maxPerKeyword: options.maxPerKeyword,
  })

  let outputPath: string | undefined
  if (options.writeCache && !options.dryRun) {
    outputPath = path.resolve(process.cwd(), "data", "beijing-pois.generated.json")
    mkdirSync(path.dirname(outputPath), { recursive: true })
    writeFileSync(outputPath, `${JSON.stringify(result.pois, null, 2)}\n`, "utf8")
  }

  console.log(JSON.stringify(sanitizeReport(result, outputPath), null, 2))
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR"
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: message,
      },
      null,
      2
    )
  )
  process.exitCode = 1
})
