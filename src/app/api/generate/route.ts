import {
  getCombinedSkillContent,
  SKILL_DETECTION_PROMPT,
  SKILL_NAMES,
  type SkillName,
} from "@/skills";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject, streamText } from "ai";
import { z } from "zod";
import { MODELS } from "@/types/generation";
import { computeCost, type UsageEntry } from "@/lib/pricing";
import { requireContext } from "@/lib/auth";
import { canSpend, charge } from "@/lib/budget-store";
import { brandSection, brandShort } from "@/lib/brand-prompts";
import {
  DEFAULT_FPS,
  DEFAULT_FORMAT,
  DEFAULT_SECONDS,
  FORMATS,
  isVideoFormat,
  type VideoFormat,
} from "@/lib/video-settings";

/** Consignes de format et de durée, injectées dans le prompt système. */
function formatSection(format: VideoFormat, durationInFrames: number, fps: number) {
  const f = FORMATS[format];
  const seconds = (durationInFrames / fps).toFixed(1);
  const layout =
    format === "9:16"
      ? `- VERTICAL ${f.width}x${f.height} (9:16) for Instagram Reels / TikTok / YouTube Shorts.
- Design for mobile: huge bold text (titles 110-180px), safe margins of 80px on the sides,
  keep important content away from the top 200px and bottom 350px (Instagram UI overlays).`
      : format === "1:1"
        ? `- SQUARE ${f.width}x${f.height} (1:1) for an Instagram / Facebook feed post.
- Titles 90-150px, safe margins of 80px on every side, keep the layout centered and compact.`
        : `- LANDSCAPE ${f.width}x${f.height} (16:9) for YouTube / websites.
- Titles 100-170px, safe margins of 100px, use the horizontal space (side-by-side layouts work well).`;
  return `## VIDEO FORMAT AND DURATION (CRITICAL)

${layout}
- Always read the size from useVideoConfig() (width, height) instead of hard-coding it, so nothing overflows.
- The video lasts EXACTLY ${durationInFrames} frames at ${fps} fps (${seconds} s). Plan every scene so the
  whole story fits in that time, and keep the final call-to-action on screen for the last 1.5-2 seconds.
- Short-form rhythm: a strong hook in the first 1-2 seconds, then a new beat every 1.5-3 seconds.
- Text must NEVER be cut off or overflow the frame: wrap long lines, reduce font size if needed.`;
}

const VALIDATION_PROMPT = `You are a prompt classifier for a motion graphics generation tool.

Determine if the user's prompt is asking for motion graphics/animation content that can be created as a React/Remotion component.

VALID prompts include requests for:
- Animated text, titles, or typography
- Data visualizations (charts, graphs, progress bars)
- UI animations (buttons, cards, transitions)
- Logo animations or brand intros
- Social media content (stories, reels, posts)
- Explainer animations
- Kinetic typography
- Abstract motion graphics
- Animated illustrations
- Product showcases
- Countdown timers
- Loading animations
- Any visual/animated content

INVALID prompts include:
- Questions (e.g., "What is 2+2?", "How do I...")
- Requests for text/written content (poems, essays, stories, code explanations)
- Conversations or chat
- Non-visual tasks (calculations, translations, summaries)
- Requests completely unrelated to visual content

Return true if the prompt is valid for motion graphics generation, false otherwise.`;

const SYSTEM_PROMPT = `
You are an expert in generating React components for Remotion animations.

## COMPONENT STRUCTURE

1. Start with ES6 imports
2. Export as: export const MyAnimation = () => { ... };
3. Component body order:
   - Multi-line comment description (2-3 sentences)
   - Hooks (useCurrentFrame, useVideoConfig, etc.)
   - Constants (COLORS, TEXT, TIMING, LAYOUT) - all UPPER_SNAKE_CASE
   - Calculations and derived values
   - return JSX

## CONSTANTS RULES (CRITICAL)

ALL constants MUST be defined INSIDE the component body, AFTER hooks:
- Colors: const COLOR_TEXT = "#000000";
- Text: const TITLE_TEXT = "Hello World";
- Timing: const FADE_DURATION = 20;
- Layout: const PADDING = 40;

This allows users to easily customize the animation.

## LAYOUT RULES

- Use full width of container with appropriate padding
- Never constrain content to a small centered box
- Use Math.max(minValue, Math.round(width * percentage)) for responsive sizing

## ANIMATION RULES

- Prefer spring() for organic motion (entrances, bounces, scaling)
- Use interpolate() for linear progress (progress bars, opacity fades)
- Always use { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
- Add stagger delays for multiple elements

## AVAILABLE IMPORTS

\`\`\`tsx
import { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate, spring, Sequence, Img } from "remotion";
import { TransitionSeries, linearTiming, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { Circle, Rect, Triangle, Star, Ellipse, Pie } from "@remotion/shapes";
import { ThreeCanvas } from "@remotion/three";
import { useState, useEffect } from "react";
\`\`\`

## RESERVED NAMES (CRITICAL)

NEVER use these as variable names - they shadow imports:
- spring, interpolate, useCurrentFrame, useVideoConfig, AbsoluteFill, Sequence

## STYLING RULES

- Use inline styles only
- ALWAYS use fontFamily: 'Inter, sans-serif'
- Keep colors minimal (2-4 max)
- ALWAYS set backgroundColor on AbsoluteFill from frame 0 - never fade in backgrounds
- interpolate() with extrapolateLeft "clamp" returns the FIRST output value for every frame BEFORE the first
  input point. For anything that must be invisible before it starts (flashes, overlays, late elements), the output
  range MUST start at 0: e.g. interpolate(frame, [start - 1, start, start + 2, start + 8], [0, 0.9, 0.9, 0], clamp).
  Never write interpolate(frame, [start, start + 2, start + 8], [0.9, 0.9, 0], clamp): it covers the screen
  for all frames before start.
- Full-screen overlays (white flashes, color wipes) must be visible for a few frames only, never during a scene.

{{FORMAT_SECTION}}

## PRODUCT PHOTOS (PRODUCT_IMAGES)

A global array \`PRODUCT_IMAGES\` (string[] of image URLs) is available WITHOUT import.
It contains the photos the user uploaded, in order. When it is non-empty and the request is about
products/ads, SHOW the real photos: \`<Img src={PRODUCT_IMAGES[0]} style={{ objectFit: "cover" }} />\`.
- Import Img from "remotion" (never use a plain <img>).
- Always guard: \`PRODUCT_IMAGES[i % PRODUCT_IMAGES.length]\` and handle an empty array gracefully.
- Never invent image URLs.

{{BRAND_SECTION}}

## OUTPUT FORMAT (CRITICAL)

- Output ONLY code - no explanations, no questions
- Response must start with "import" and end with "};"
- If prompt is ambiguous, make a reasonable choice - do not ask for clarification

`;

const FOLLOW_UP_SYSTEM_PROMPT = `
You are an expert at making targeted edits to React/Remotion animation components.

{{BRAND_SHORT}}

Given the current code and a user request, decide whether to:
1. Use targeted edits (for small, specific changes)
2. Provide full replacement code (for major restructuring)

## WHEN TO USE TARGETED EDITS (type: "edit")
- Changing colors, text, numbers, timing values
- Adding or removing a single element
- Modifying styles or properties
- Small additions (new variable, new element)
- Changes affecting <30% of the code

## WHEN TO USE FULL REPLACEMENT (type: "full")
- Completely different animation style
- Major structural reorganization
- User asks to "start fresh" or "rewrite"
- Changes affect >50% of the code

## EDIT FORMAT
For targeted edits, each edit needs:
- old_string: The EXACT string to find (including whitespace/indentation)
- new_string: The replacement string

CRITICAL:
- old_string must match the code EXACTLY character-for-character
- Include enough surrounding context to make old_string unique
- If multiple similar lines exist, include more surrounding code
- Preserve indentation exactly as it appears in the original

## PRESERVING USER EDITS
If the user has made manual edits, preserve them unless explicitly asked to change.
`;

// Schema for follow-up edit responses
// Note: Using a flat object schema because some providers don't support discriminated unions
const FollowUpResponseSchema = z.object({
  type: z
    .enum(["edit", "full"])
    .describe(
      'Use "edit" for small targeted changes, "full" for major restructuring',
    ),
  summary: z
    .string()
    .describe(
      "A brief 1-sentence summary IN FRENCH of what changes were made, e.g. 'Fond passé en bleu et texte agrandi'",
    ),
  edits: z
    .array(
      z.object({
        description: z
          .string()
          .describe(
            "Brief description of this edit, e.g. 'Update background color', 'Increase animation duration'",
          ),
        old_string: z
          .string()
          .describe("The exact string to find (must match exactly)"),
        new_string: z.string().describe("The replacement string"),
      }),
    )
    .optional()
    .describe(
      "Required when type is 'edit': array of search-replace operations",
    ),
  code: z
    .string()
    .optional()
    .describe(
      "Required when type is 'full': the complete replacement code starting with imports",
    ),
});

type EditOperation = {
  description: string;
  old_string: string;
  new_string: string;
  lineNumber?: number;
};

// Calculate line number where a string occurs in code
function getLineNumber(code: string, searchString: string): number {
  const index = code.indexOf(searchString);
  if (index === -1) return -1;
  return code.substring(0, index).split("\n").length;
}

// Apply edit operations to code and enrich with line numbers
function applyEdits(
  code: string,
  edits: EditOperation[],
): {
  success: boolean;
  result: string;
  error?: string;
  enrichedEdits?: EditOperation[];
  failedEdit?: EditOperation;
} {
  let result = code;
  const enrichedEdits: EditOperation[] = [];

  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];
    const { old_string, new_string, description } = edit;

    // Check if the old_string exists
    if (!result.includes(old_string)) {
      return {
        success: false,
        result: code,
        error: `Edit ${i + 1} failed: Could not find the specified text`,
        failedEdit: edit,
      };
    }

    // Check for multiple matches (ambiguous)
    const matches = result.split(old_string).length - 1;
    if (matches > 1) {
      return {
        success: false,
        result: code,
        error: `Edit ${i + 1} failed: Found ${matches} matches. The edit target is ambiguous.`,
        failedEdit: edit,
      };
    }

    // Get line number before applying edit
    const lineNumber = getLineNumber(result, old_string);

    // Apply the edit
    result = result.replace(old_string, new_string);

    // Store enriched edit with line number
    enrichedEdits.push({
      description,
      old_string,
      new_string,
      lineNumber,
    });
  }

  return { success: true, result, enrichedEdits };
}

interface ConversationContextMessage {
  role: "user" | "assistant";
  content: string;
  /** For user messages, attached images as base64 data URLs */
  attachedImages?: string[];
}

interface ErrorCorrectionContext {
  error: string;
  attemptNumber: number;
  maxAttempts: number;
  failedEdit?: {
    description: string;
    old_string: string;
    new_string: string;
  };
}

interface GenerateRequest {
  prompt: string;
  model?: string;
  currentCode?: string;
  conversationHistory?: ConversationContextMessage[];
  isFollowUp?: boolean;
  hasManualEdits?: boolean;
  /** Error correction context for self-healing loops */
  errorCorrection?: ErrorCorrectionContext;
  /** Skills already used in this conversation (to avoid redundant skill content) */
  previouslyUsedSkills?: string[];
  /** Base64 image data URLs for visual context */
  frameImages?: string[];
  /** Nombre de photos produits en tête de frameImages (nouvellement envoyées) */
  newProductImageCount?: number;
  /** Taille totale de PRODUCT_IMAGES côté client */
  productImageCount?: number;
  format?: VideoFormat;
  durationInFrames?: number;
  fps?: number;
}

const FAST_MODEL = process.env.CLAUDE_FAST_MODEL ?? "claude-haiku-5-5";

function productImagesNotice(newCount: number, total: number): string {
  if (total <= 0) return "";
  const which =
    newCount > 0
      ? `The first ${newCount} attached image(s) are the product photos, available in code as PRODUCT_IMAGES[0]..PRODUCT_IMAGES[${newCount - 1}]. Any other attached image is a screenshot of the current animation.`
      : `PRODUCT_IMAGES contains ${total} product photo(s) uploaded earlier (indices 0..${total - 1}).`;
  return `\n\n## PRODUCT PHOTOS\n${which} Use them in the video with <Img src={PRODUCT_IMAGES[i]} />.`;
}

interface GenerateResponse {
  code: string;
  summary: string;
  metadata: {
    skills: string[];
    editType: "tool_edit" | "full_replacement";
    edits?: EditOperation[];
    model: string;
    cost?: number;
    inputTokens?: number;
    outputTokens?: number;
  };
}

export async function POST(req: Request) {
  const ctx = await requireContext();
  if (ctx instanceof Response) return ctx;
  if (!(await canSpend(ctx.space))) {
    return new Response(
      JSON.stringify({ error: "Crédit épuisé : contacte l'équipe HytLabs pour recharger ton espace." }),
      { status: 402, headers: { "Content-Type": "application/json" } },
    );
  }
  const {
    prompt,
    model = "claude-haiku-5-5",
    currentCode,
    conversationHistory = [],
    isFollowUp = false,
    hasManualEdits = false,
    errorCorrection,
    previouslyUsedSkills = [],
    frameImages,
    newProductImageCount = 0,
    productImageCount = 0,
    format: rawFormat,
    durationInFrames: rawDuration,
    fps: rawFps,
  }: GenerateRequest = await req.json();

  const format: VideoFormat = isVideoFormat(rawFormat) ? rawFormat : DEFAULT_FORMAT;
  const fps = Math.min(60, Math.max(10, Number(rawFps) || DEFAULT_FPS));
  const durationInFrames = Math.min(
    fps * 60,
    Math.max(fps * 3, Number(rawDuration) || DEFAULT_SECONDS * fps),
  );
  const videoSection = formatSection(format, durationInFrames, fps);
  // Tokens consommés par chaque appel, pour afficher le coût de la génération
  const usages: UsageEntry[] = [];

  // OpenRouter (format Messages compatible Anthropic) prioritaire s'il est configuré
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const apiKey = openRouterKey || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error:
          'Aucune clé API configurée (OPENROUTER_API_KEY ou ANTHROPIC_API_KEY dans le fichier .env).',
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Format du modèle : "claude-xxx" ou "claude-xxx:thinking"
  // Seuls les modèles proposés dans l'interface sont acceptés (maîtrise des coûts)
  const allowed: string[] = MODELS.map((m) => m.id);
  const [modelName, reasoningEffort] = (
    allowed.includes(model) ? model : "claude-haiku-5-5"
  ).split(":");
  const imagesNotice = productImagesNotice(newProductImageCount, productImageCount);

  const provider = openRouterKey
    ? createAnthropic({
        apiKey,
        baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "X-Title": "HytLabs Studio",
        },
      })
    : createAnthropic({ apiKey });
  // "claude-sonnet-5-5" -> "anthropic/claude-sonnet-5.5" pour OpenRouter
  const toProviderModel = (id: string) =>
    openRouterKey && !id.includes("/")
      ? `anthropic/${id.replace(/-(\d+)-(\d+)$/, "-$1.$2")}`
      : id;
  const anthropic = (id: string) => provider(toProviderModel(id));

  // Validate the prompt first (skip for follow-ups with existing code)
  if (!isFollowUp) {
    try {
      const validationResult = await generateObject({
        model: anthropic(FAST_MODEL),
        system: VALIDATION_PROMPT,
        prompt: `User prompt: "${prompt}"`,
        schema: z.object({ valid: z.boolean() }),
      });
      usages.push({ model: FAST_MODEL, ...validationResult.usage });

      if (!validationResult.object.valid) {
        return new Response(
          JSON.stringify({
            error:
              "Cette demande ne décrit pas une vidéo. Décris l'animation ou la pub que tu veux créer.",
            type: "validation",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
    } catch (validationError) {
      // On validation error, allow through rather than blocking
      console.error("Validation error:", validationError);
    }
  }

  // Detect which skills apply to this prompt
  let detectedSkills: SkillName[] = [];
  try {
    const skillResult = await generateObject({
      model: anthropic(FAST_MODEL),
      system: SKILL_DETECTION_PROMPT,
      prompt: `User prompt: "${prompt}"`,
      schema: z.object({
        skills: z.array(z.enum(SKILL_NAMES)),
      }),
    });
    detectedSkills = skillResult.object.skills;
    usages.push({ model: FAST_MODEL, ...skillResult.usage });
    console.log("Detected skills:", detectedSkills);
  } catch (skillError) {
    console.error("Skill detection error:", skillError);
  }

  // Filter out skills that were already used in the conversation to avoid redundant context
  const newSkills = detectedSkills.filter(
    (skill) => !previouslyUsedSkills.includes(skill),
  );
  if (
    previouslyUsedSkills.length > 0 &&
    newSkills.length < detectedSkills.length
  ) {
    console.log(
      `Skipping ${detectedSkills.length - newSkills.length} previously used skills:`,
      detectedSkills.filter((s) => previouslyUsedSkills.includes(s)),
    );
  }

  // Load skill-specific content only for NEW skills (previously used skills are already in context)
  const skillContent = getCombinedSkillContent(newSkills as SkillName[]);
  const basePrompt = SYSTEM_PROMPT.replace("{{FORMAT_SECTION}}", videoSection).replace(
    "{{BRAND_SECTION}}",
    brandSection(ctx.space),
  );
  const enhancedSystemPrompt = skillContent
    ? `${basePrompt}\n\n## SKILL-SPECIFIC GUIDANCE\n${skillContent}`
    : basePrompt;

  // FOLLOW-UP MODE: Use non-streaming generateObject for faster edits
  if (isFollowUp && currentCode) {
    try {
      // Build context for the edit request
      const contextMessages = conversationHistory.slice(-6);
      let conversationContext = "";
      if (contextMessages.length > 0) {
        conversationContext =
          "\n\n## RECENT CONVERSATION:\n" +
          contextMessages
            .map((m) => {
              const imageNote =
                m.attachedImages && m.attachedImages.length > 0
                  ? ` [with ${m.attachedImages.length} attached image${m.attachedImages.length > 1 ? "s" : ""}]`
                  : "";
              return `${m.role.toUpperCase()}: ${m.content}${imageNote}`;
            })
            .join("\n");
      }

      const manualEditNotice = hasManualEdits
        ? "\n\nNOTE: The user has made manual edits to the code. Preserve these changes."
        : "";

      // Error correction context for self-healing
      let errorCorrectionNotice = "";
      if (errorCorrection) {
        const failedEditInfo = errorCorrection.failedEdit
          ? `

The previous edit attempt failed. Here's what was tried:
- Description: ${errorCorrection.failedEdit.description}
- Tried to find: \`${errorCorrection.failedEdit.old_string}\`
- Wanted to replace with: \`${errorCorrection.failedEdit.new_string}\`

The old_string was either not found or matched multiple locations. You MUST include more surrounding context to make the match unique.`
          : "";

        const isEditFailure =
          errorCorrection.error.includes("Edit") &&
          errorCorrection.error.includes("failed");

        if (isEditFailure) {
          errorCorrectionNotice = `

## EDIT FAILED (ATTEMPT ${errorCorrection.attemptNumber}/${errorCorrection.maxAttempts})
${errorCorrection.error}
${failedEditInfo}

CRITICAL: Your previous edit target was ambiguous or not found. To fix this:
1. Include MORE surrounding code context in old_string to make it unique
2. Make sure old_string matches the code EXACTLY (including whitespace)
3. If the code structure changed, look at the current code carefully`;
        } else {
          errorCorrectionNotice = `

## COMPILATION ERROR (ATTEMPT ${errorCorrection.attemptNumber}/${errorCorrection.maxAttempts})
The previous code failed to compile with this error:
\`\`\`
${errorCorrection.error}
\`\`\`

CRITICAL: Fix this compilation error. Common issues include:
- Syntax errors (missing brackets, semicolons)
- Invalid JSX (unclosed tags, invalid attributes)
- Undefined variables or imports
- TypeScript type errors

Focus ONLY on fixing the error. Do not make other changes.`;
        }
      }

      const editPromptText = `## CURRENT CODE:
\`\`\`tsx
${currentCode}
\`\`\`
${conversationContext}
${manualEditNotice}
${errorCorrectionNotice}

## USER REQUEST:
${prompt}
${frameImages && frameImages.length > 0 ? `\n(See the attached ${frameImages.length === 1 ? "image" : "images"} for visual reference)` : ""}${imagesNotice}

Analyze the request and decide: use targeted edits (type: "edit") for small changes, or full replacement (type: "full") for major restructuring.`;

      console.log(
        "Follow-up edit with prompt:",
        prompt,
        "model:",
        modelName,
        "skills:",
        detectedSkills.length > 0 ? detectedSkills.join(", ") : "general",
        frameImages && frameImages.length > 0
          ? `(with ${frameImages.length} image(s))`
          : "",
      );

      // Build messages array - include images if provided
      const editMessageContent: Array<
        { type: "text"; text: string } | { type: "image"; image: string }
      > = [{ type: "text" as const, text: editPromptText }];
      if (frameImages && frameImages.length > 0) {
        for (const img of frameImages) {
          editMessageContent.push({ type: "image" as const, image: img });
        }
      }
      const editMessages: Array<{
        role: "user";
        content: Array<
          { type: "text"; text: string } | { type: "image"; image: string }
        >;
      }> = [
        {
          role: "user" as const,
          content: editMessageContent,
        },
      ];

      const editResult = await generateObject({
        model: anthropic(modelName),
        system: `${FOLLOW_UP_SYSTEM_PROMPT.replace("{{BRAND_SHORT}}", brandShort(ctx.space))}\n\n${videoSection}`,
        messages: editMessages,
        schema: FollowUpResponseSchema,
      });

      const response = editResult.object;
      usages.push({ model: modelName, ...editResult.usage });
      let finalCode: string;
      let editType: "tool_edit" | "full_replacement";
      let appliedEdits: EditOperation[] | undefined;

      if (response.type === "edit" && response.edits) {
        // Apply the edits to the current code
        const result = applyEdits(currentCode, response.edits);
        if (!result.success) {
          // If edits fail, return error with the failed edit details
          return new Response(
            JSON.stringify({
              error: result.error,
              type: "edit_failed",
              failedEdit: result.failedEdit,
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        finalCode = result.result;
        editType = "tool_edit";
        // Use enriched edits with line numbers
        appliedEdits = result.enrichedEdits;
        console.log(`Applied ${response.edits.length} edit(s) successfully`);
      } else if (response.type === "full" && response.code) {
        // Full replacement
        finalCode = response.code;
        editType = "full_replacement";
        console.log("Using full code replacement");
      } else {
        // Invalid response - missing required fields
        return new Response(
          JSON.stringify({
            error: "Réponse de Claude incomplète. Réessaie.",
            type: "edit_failed",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      const editCost = await computeCost(usages);
      await charge(ctx.space, editCost.cost, { kind: "retouche", by: ctx.session.email });
      // Return the result with metadata
      const responseData: GenerateResponse = {
        code: finalCode,
        summary: response.summary,
        metadata: {
          skills: detectedSkills,
          editType,
          edits: appliedEdits,
          model: modelName,
          ...editCost,
        },
      };

      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error in follow-up edit:", error);
      return new Response(
        JSON.stringify({
          error: "La modification a échoué. Réessaie, ou reformule ta demande.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  // INITIAL GENERATION: Use streaming for new animations
  try {
    // Build messages for initial generation (supports image references)
    const hasImages = frameImages && frameImages.length > 0;
    const initialPromptText =
      (hasImages
        ? `${prompt}\n\n(See the attached ${frameImages.length === 1 ? "image" : "images"} for visual reference)`
        : prompt) + imagesNotice;

    const initialMessageContent: Array<
      { type: "text"; text: string } | { type: "image"; image: string }
    > = [{ type: "text" as const, text: initialPromptText }];
    if (hasImages) {
      for (const img of frameImages) {
        initialMessageContent.push({ type: "image" as const, image: img });
      }
    }

    const initialMessages: Array<{
      role: "user";
      content: Array<
        { type: "text"; text: string } | { type: "image"; image: string }
      >;
    }> = [
      {
        role: "user" as const,
        content: initialMessageContent,
      },
    ];

    const result = streamText({
      model: anthropic(modelName),
      system: enhancedSystemPrompt,
      messages: initialMessages,
      ...(reasoningEffort && {
        providerOptions: {
          anthropic: {
            thinking: { type: "enabled", budgetTokens: 8000 },
          },
        },
      }),
    });

    console.log(
      "Generating React component with prompt:",
      prompt,
      "model:",
      modelName,
      "skills:",
      detectedSkills.length > 0 ? detectedSkills.join(", ") : "general",
      reasoningEffort ? `reasoning_effort: ${reasoningEffort}` : "",
      hasImages ? `(with ${frameImages.length} image(s))` : "",
    );

    // Get the original stream response
    const originalResponse = result.toUIMessageStreamResponse({
      sendReasoning: true,
    });

    // Create metadata event to prepend
    const metadataEvent = `data: ${JSON.stringify({
      type: "metadata",
      skills: detectedSkills,
      model: modelName,
    })}\n\n`;

    // Create a new stream that prepends metadata before the LLM stream
    const originalBody = originalResponse.body;
    if (!originalBody) {
      return originalResponse;
    }

    const reader = originalBody.getReader();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        // Send metadata event first
        controller.enqueue(encoder.encode(metadataEvent));

        // Then pipe through the original stream
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        // Coût total de la génération (validation + détection + code)
        try {
          const total = await result.totalUsage;
          usages.push({ model: modelName, ...total });
          const cost = await computeCost(usages);
          await charge(ctx.space, cost.cost, { kind: isFollowUp ? "retouche" : "generation", by: ctx.session.email });
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "cost", ...cost })}\n\n`),
          );
        } catch (costError) {
          console.error("Cost computation error:", costError);
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: originalResponse.headers,
    });
  } catch (error) {
    console.error("Error generating code:", error);
    return new Response(
      JSON.stringify({
        error: "Impossible de joindre Claude pour le moment. Réessaie dans un instant.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
