interface Env {
	AI: Ai;
}

const MODEL = "@cf/stabilityai/stable-diffusion-xl-base-1.0";

export default {
	async fetch(
		request: Request,
		env: Env
	): Promise<Response> {
		const url = new URL(request.url);

		/*
		 * MAIN HTML PAGE
		 */
		if (request.method === "GET" && url.pathname === "/") {
			return new Response(getHtml(), {
				status: 200,
				headers: {
					"Content-Type": "text/html; charset=UTF-8"
				}
			});
		}

		/*
		 * IMAGE GENERATION API
		 */
		if (request.method === "POST" && url.pathname === "/generate") {
			try {
				const body = (await request.json()) as { prompt?: string };

				if (!body.prompt || typeof body.prompt !== "string") {
					return json({ success: false, error: "Prompt required" }, 400);
				}

				const result = await env.AI.run(MODEL, { prompt: body.prompt });

				// Convert ReadableStream / ArrayBuffer to Base64 safely
				const arrayBuffer = await new Response(result as ReadableStream).arrayBuffer();
				const bytes = new Uint8Array(arrayBuffer);
				let binary = "";
				for (let i = 0; i < bytes.byteLength; i++) {
					binary += String.fromCharCode(bytes[i]);
				}
				const base64 = btoa(binary);

				return json({ success: true, image: base64 });
			} catch (error) {
				return json(
					{
						success: false,
						error: error instanceof Error ? error.message : String(error)
					},
					500
				);
			}
		}

		return new Response("Not Found", { status: 404 });
	}
} satisfies ExportedHandler<Env>;

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "Content-Type": "application/json" }
	});
}

function getHtml(): string {
	return '<!DOCTYPE html>' +
	'<html lang="en">' +
	'<head>' +
		'<meta charset="UTF-8">' +
		'<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
		'<title>AI Image & MP4 Generator</title>' +
		'<style>' +
			'* { box-sizing: border-box; }' +
			'body { margin: 0; padding: 16px; background: #111; color: white; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }' +
			'h1 { text-align: center; margin: 0 0 16px 0; font-size: 1.8rem; }' +
			'.input-section { width: 100%; max-width: 900px; margin: 0 auto 24px auto; background: #222; padding: 16px; border-radius: 10px; }' +
			'textarea { width: 100%; height: 140px; background: #181818; color: #fff; border: 1px solid #333; border-radius: 7px; padding: 12px; font-family: monospace; font-size: 14px; resize: vertical; }' +
			'.actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 15px; align-items: center; justify-content: space-between; }' +
			'button { background: #0070f3; color: white; border: none; padding: 12px 20px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 14px; flex: 1 1 auto; min-width: 160px; }' +
			'button:disabled { background: #444; cursor: not-allowed; }' +
			'button.compile-btn { background: #10b981; }' +
			'.counter-badge { font-size: 14px; color: #aaa; text-align: center; }' +
			'.gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; width: 100%; max-width: 1200px; margin: 0 auto; }' +
			'.card { background: #222; border-radius: 10px; padding: 10px; overflow: hidden; position: relative; border: 2px solid transparent; cursor: pointer; transition: border-color 0.2s; display: flex; flex-direction: column; }' +
			'.card.selected { border-color: #10b981; }' +
			'.select-overlay { position: absolute; top: 15px; right: 15px; width: 24px; height: 24px; border-radius: 50%; background: rgba(0,0,0,0.6); border: 1px solid #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; color: white; z-index: 2; }' +
			'.card.selected .select-overlay { background: #10b981; border-color: #10b981; }' +
			'.image-container { width: 100%; aspect-ratio: 16 / 9; background: #181818; border-radius: 7px; display: flex; align-items: center; justify-content: center; overflow: hidden; }' +
			'.image-container img { width: 100%; height: 100%; object-fit: cover; display: block; }' +
			'.loading { color: #777; font-size: 13px; text-align: center; }' +
			'.error { color: #ff5555; font-size: 13px; text-align: center; padding: 10px; }' +
			'.prompt { margin-top: 10px; font-size: 12px; line-height: 1.4; color: #bbb; max-height: 40px; overflow: hidden; text-overflow: ellipsis; }' +
			'.video-preview { width: 100%; max-width: 800px; margin: 20px auto; text-align: center; }' +
			'video { width: 100%; border-radius: 10px; background: #000; }' +
			'@media (max-width: 600px) { body { padding: 10px; } .actions { flex-direction: column; align-items: stretch; } button { width: 100%; } }' +
		'</style>' +
	'</head>' +
	'<body>' +

		'<h1>AI Image to MP4 Generator</h1>' +

		'<div class="input-section">' +
			'<label for="promptInput" style="display:block; margin-bottom: 8px; font-weight: bold;">' +
				'Enter Prompts (1 per line — e.g. 5 or 7 lines):' +
			'</label>' +
			'<textarea id="promptInput" placeholder="Prompt line 1...\nPrompt line 2...\nPrompt line 3...\nPrompt line 4...\nPrompt line 5..."></textarea>' +
			
			'<div class="actions">' +
				'<button id="generateBtn" onclick="startBatch()">Generate Images</button>' +
				'<div class="counter-badge">' +
					'Selected: <span id="selectedCount">0</span> / Min: 5' +
				'</div>' +
				'<button id="compileBtn" class="compile-btn" onclick="compileToMP4()" disabled>' +
					'Compile MP4 Video' +
				'</button>' +
			'</div>' +
		'</div>' +

		'<div id="videoContainer" class="video-preview"></div>' +
		'<div id="gallery" class="gallery"></div>' +

		'<script>' +
			'console.log("[App Init] Client-side scripts mounted.");' +
			'let loadedImages = {};' +
			'let selectedIndices = new Set();' +

			'async function startBatch() {' +
				'console.log("[User Action] Clicked \"Generate Images\" button.");' +
				'const text = document.getElementById("promptInput").value;' +
				'const lines = text.split("\\n").map(l => l.trim()).filter(l => l.length > 0);' +
				'console.log("[Input Event] Parsed " + lines.length + " non-empty prompt line(s):", lines);' +

				'if (lines.length === 0) {' +
					'console.warn("[Input Event] No valid prompt lines entered. Aborting batch generation.");' +
					'alert("Please enter at least one prompt line.");' +
					'return;' +
				'}' +

				'const prompts = lines.slice(0, 30);' +
				'const gallery = document.getElementById("gallery");' +
				'const generateBtn = document.getElementById("generateBtn");' +

				'generateBtn.disabled = true;' +
				'generateBtn.textContent = "Generating...";' +
				'gallery.innerHTML = "";' +
				'selectedIndices.clear();' +
				'loadedImages = {};' +
				'updateCompileButton();' +

				'console.log("[UI Update] Building gallery placeholders for " + prompts.length + " card(s).");' +
				'prompts.forEach((prompt, index) => {' +
					'const card = document.createElement("div");' +
					'card.className = "card";' +
					'card.id = "card-" + index;' +
					'card.onclick = () => toggleSelect(index);' +

					'card.innerHTML = "<div class=\\"select-overlay\\" id=\\"check-" + index + "\\">✓</div>"' +
						'+ "<div class=\\"image-container\\" id=\\"image-" + index + "\\">"' +
							'+ "<div class=\\"loading\\">Queued (" + (index + 1) + ")...</div>"' +
						'+ "</div>"' +
						'+ "<div class=\\"prompt\\">" + (index + 1) + ". " + escapeHTML(prompt) + "</div>";' +
					'gallery.appendChild(card);' +
				'});' +

				'console.log("[Batch Process] Starting sequential generation queue...");' +
				'for (let i = 0; i < prompts.length; i++) {' +
					'await generateImage(prompts[i], i);' +
				'}' +

				'console.log("[Batch Process] Batch queue execution complete.");' +
				'generateBtn.disabled = false;' +
				'generateBtn.textContent = "Generate Images";' +
			'}' +

			'async function generateImage(prompt, index) {' +
				'console.log("[Request Start] Generating image " + (index + 1) + " with prompt: \"" + prompt + "\"");' +
				'const container = document.getElementById("image-" + index);' +
				'container.innerHTML = "<div class=\\"loading\\">Generating image " + (index + 1) + "...</div>";' +

				'try {' +
					'const response = await fetch("/generate", {' +
						'method: "POST",' +
						'headers: { "Content-Type": "application/json" },' +
						'body: JSON.stringify({ prompt })' +
					'});' +

					'const data = await response.json();' +

					'if (!response.ok || !data.success) {' +
						'throw new Error(data.error || "Generation failed");' +
					'}' +

					'console.log("[Request Success] Image " + (index + 1) + " generated successfully.");' +
					'const img = new Image();' +
					'img.src = "data:image/png;base64," + data.image;' +
					'img.alt = "Generated image " + (index + 1);' +

					'container.innerHTML = "";' +
					'container.appendChild(img);' +
					'loadedImages[index] = img;' +

				'} catch (error) {' +
					'console.error("[Request Error] Image " + (index + 1) + " failed:", error);' +
					'container.innerHTML = "<div class=\\"error\\">" + (error.message || "Failed") + "</div>";' +
				'}' +
			'}' +

			'function toggleSelect(index) {' +
				'console.log("[User Action] Clicked card #" + (index + 1));' +
				'if (!loadedImages[index]) {' +
					'console.log("[Card Select Ignored] Card #" + (index + 1) + " has not finished loading.");' +
					'return;' +
				'}' +

				'const card = document.getElementById("card-" + index);' +

				'if (selectedIndices.has(index)) {' +
					'selectedIndices.delete(index);' +
					'card.classList.remove("selected");' +
					'console.log("[Card Unselected] Removed card #" + (index + 1) + ". Total selected: " + selectedIndices.size);' +
				'} else {' +
					'selectedIndices.add(index);' +
					'card.classList.add("selected");' +
					'console.log("[Card Selected] Added card #" + (index + 1) + ". Total selected: " + selectedIndices.size);' +
				'}' +

				'updateCompileButton();' +
			'}' +

			'function updateCompileButton() {' +
				'const count = selectedIndices.size;' +
				'document.getElementById("selectedCount").textContent = count;' +
				'const compileBtn = document.getElementById("compileBtn");' +
				'compileBtn.disabled = count < 5;' +
				'console.log("[UI Update] Selection counter updated: " + count + "/5 minimum. Compile button enabled: " + (!compileBtn.disabled));' +
			'}' +

			'async function compileToMP4() {' +
				'console.log("[User Action] Clicked \"Compile MP4 Video\" button.");' +
				'if (selectedIndices.size < 5) {' +
					'console.warn("[Compile Ignored] Requires at least 5 selected images. Current count: " + selectedIndices.size);' +
					'alert("Please select at least 5 images!");' +
					'return;' +
				'}' +

				'const videoContainer = document.getElementById("videoContainer");' +
				'videoContainer.innerHTML = "<h3>Compiling video... Please wait.</h3>";' +

				'const canvas = document.createElement("canvas");' +
				'canvas.width = 1280;' +
				'canvas.height = 720;' +
				'const ctx = canvas.getContext("2d");' +

				'const stream = canvas.captureStream(30);' +
				'let mimeType = "video/mp4";' +
				'if (!MediaRecorder.isTypeSupported(mimeType)) {' +
					'mimeType = "video/webm;codecs=vp9";' +
				'}' +

				'console.log("[MediaRecorder Init] Target codec MIME type: " + mimeType);' +
				'const recorder = new MediaRecorder(stream, { mimeType });' +
				'const chunks = [];' +

				'recorder.ondataavailable = (e) => chunks.push(e.data);' +
				'recorder.onstop = () => {' +
					'console.log("[MediaRecorder Stop] Video compile complete. Generating download link.");' +
					'const blob = new Blob(chunks, { type: mimeType });' +
					'const videoUrl = URL.createObjectURL(blob);' +

					'videoContainer.innerHTML = "<h2>Compiled Video</h2>"' +
						'+ "<video src=\\"" + videoUrl + "\\" controls autoplay></video><br><br>"' +
						'+ "<a href=\\"" + videoUrl + "\\" download=\\"generated-slideshow.' + (mimeType.includes("mp4") ? "mp4" : "webm") + '\\" style=\\"color: #10b981; font-weight: bold;\\">Download Video File</a>";' +
				'};' +

				'recorder.start();' +
				'const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);' +
				'console.log("[Render Loop] Rendering selected frame sequence indices:", sortedIndices);' +

				'for (const idx of sortedIndices) {' +
					'console.log("[Render Loop] Rendering card #" + (idx + 1) + " to canvas (60 frames)...");' +
					'const img = loadedImages[idx];' +
					'for (let frame = 0; frame < 60; frame++) {' +
						'ctx.drawImage(img, 0, 0, canvas.width, canvas.height);' +
						'await new Promise((resolve) => setTimeout(resolve, 1000 / 30));' +
					'}' +
				'}' +

				'recorder.stop();' +
			'}' +

			'function escapeHTML(str) {' +
				'return str.replace(/[&<>\'"]/g, ' +
					'tag => ({ \'&\': \'&amp;\', \'<\': \'&lt;\', \'>\': \'&gt;\', "\'": \'&#39;\', \'"\': \'&quot;\' }[tag] || tag)' +
				');' +
			'}' +
		'</script>' +
	'</body>' +
	'</html>';
		}
