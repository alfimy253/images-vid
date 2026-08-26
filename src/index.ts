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
		 * MAIN PAGE
		 */
		if (
			request.method === "GET" &&
			url.pathname === "/"
		) {
			return new Response(
				createHTML(),
				{
					status: 200,
					headers: {
						"Content-Type": "text/html; charset=UTF-8"
					}
				}
			);
		}

		/*
		 * IMAGE GENERATION API
		 * Accepts dynamic prompt and returns Base64 PNG
		 */
		if (
			request.method === "POST" &&
			url.pathname === "/generate"
		) {
			try {
				const body = (await request.json()) as { prompt?: string };

				if (!body.prompt || typeof body.prompt !== "string") {
					return json(
						{ success: false, error: "Prompt required" },
						400
					);
				}

				const result = await env.AI.run(
					MODEL,
					{ prompt: body.prompt }
				);

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

/*
 * JSON helper.
 */
function json(
	data: unknown,
	status = 200
): Response {
	return new Response(
		JSON.stringify(data),
		{
			status,
			headers: {
				"Content-Type": "application/json"
			}
		}
	);
}

/*
 * HTML Page with responsive CSS, flexible line input, and robust video synthesis.
 */
function createHTML(): string {
	return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>AI Image to MP4 Generator</title>

	<style>
		* {
			box-sizing: border-box;
		}

		body {
			margin: 0;
			padding: 16px;
			background: #111;
			color: white;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
		}

		h1 {
			text-align: center;
			margin: 0 0 16px 0;
			font-size: 1.8rem;
		}

		.input-section {
			width: 100%;
			max-width: 900px;
			margin: 0 auto 24px auto;
			background: #222;
			padding: 16px;
			border-radius: 10px;
		}

		textarea {
			width: 100%;
			height: 150px;
			background: #181818;
			color: #fff;
			border: 1px solid #333;
			border-radius: 7px;
			padding: 12px;
			font-family: monospace;
			font-size: 14px;
			resize: vertical;
		}

		.actions {
			display: flex;
			flex-wrap: wrap;
			gap: 12px;
			margin-top: 15px;
			align-items: center;
			justify-content: space-between;
		}

		button {
			background: #0070f3;
			color: white;
			border: none;
			padding: 12px 20px;
			border-radius: 6px;
			font-weight: bold;
			cursor: pointer;
			font-size: 14px;
			flex: 1 1 auto;
			min-width: 160px;
		}

		button:disabled {
			background: #444;
			cursor: not-allowed;
		}

		button.compile-btn {
			background: #10b981;
		}

		.counter-badge {
			font-size: 14px;
			color: #aaa;
			text-align: center;
		}

		/* Responsive Grid Layout */
		.gallery {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
			gap: 16px;
			width: 100%;
			max-width: 1200px;
			margin: 0 auto;
		}

		.card {
			background: #222;
			border-radius: 10px;
			padding: 10px;
			overflow: hidden;
			position: relative;
			border: 2px solid transparent;
			cursor: pointer;
			transition: border-color 0.2s;
			display: flex;
			flex-direction: column;
		}

		.card.selected {
			border-color: #10b981;
		}

		.select-overlay {
			position: absolute;
			top: 15px;
			right: 15px;
			width: 24px;
			height: 24px;
			border-radius: 50%;
			background: rgba(0,0,0,0.6);
			border: 1px solid #fff;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 12px;
			color: white;
			z-index: 2;
		}

		.card.selected .select-overlay {
			background: #10b981;
			border-color: #10b981;
		}

		.image-container {
			width: 100%;
			aspect-ratio: 16 / 9;
			background: #181818;
			border-radius: 7px;
			display: flex;
			align-items: center;
			justify-content: center;
			overflow: hidden;
		}

		.image-container img {
			width: 100%;
			height: 100%;
			object-fit: cover;
			display: block;
		}

		.loading {
			color: #777;
			font-size: 13px;
			text-align: center;
		}

		.error {
			color: #ff5555;
			font-size: 13px;
			text-align: center;
			padding: 10px;
		}

		.prompt {
			margin-top: 10px;
			font-size: 12px;
			line-height: 1.4;
			color: #bbb;
			max-height: 40px;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.video-preview {
			width: 100%;
			max-width: 800px;
			margin: 20px auto;
			text-align: center;
		}

		video {
			width: 100%;
			border-radius: 10px;
			background: #000;
		}

		@media (max-width: 600px) {
			body {
				padding: 10px;
			}
			.actions {
				flex-direction: column;
				align-items: stretch;
			}
			button {
				width: 100%;
			}
		}
	</style>
</head>

<body>

	<h1>AI Image to MP4 Generator</h1>

	<div class="input-section">
		<label for="promptInput" style="display:block; margin-bottom: 8px; font-weight: bold;">
			Enter your Prompts (1 prompt per line — minimum 5 recommended):
		</label>
		<textarea id="promptInput" placeholder="Prompt 1: Epic landscape...&#10;Prompt 2: Futuristic city...&#10;Prompt 3: Cyberpunk street...&#10;Prompt 4: Cozy cafe in rain...&#10;Prompt 5: Astronaut on Mars..."></textarea>
		
		<div class="actions">
			<button id="generateBtn" onclick="startBatch()">Generate Images</button>
			
			<div class="counter-badge">
				Selected: <span id="selectedCount">0</span> / Min: 5
			</div>

			<button id="compileBtn" class="compile-btn" onclick="compileToMP4()" disabled>
				Compile MP4 Video
			</button>
		</div>
	</div>

	<div id="videoContainer" class="video-preview"></div>

	<div id="gallery" class="gallery"></div>

	<script>
		let loadedImages = {};
		let selectedIndices = new Set();

		async function startBatch() {
			const text = document.getElementById("promptInput").value;
			const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);

			if (lines.length === 0) {
				alert("Please enter at least one prompt line.");
				return;
			}

			const prompts = lines.slice(0, 30); // Accept 5, 7, or up to 30 lines
			const gallery = document.getElementById("gallery");
			const generateBtn = document.getElementById("generateBtn");

			generateBtn.disabled = true;
			generateBtn.textContent = "Generating...";
			gallery.innerHTML = "";
			selectedIndices.clear();
			loadedImages = {};
			updateCompileButton();

			// Render cards for every entered line
			prompts.forEach((prompt, index) => {
				const card = document.createElement("div");
				card.className = "card";
				card.id = "card-" + index;
				card.onclick = () => toggleSelect(index);

				card.innerHTML = \`
					<div class="select-overlay" id="check-\${index}">✓</div>
					<div class="image-container" id="image-\${index}">
						<div class="loading">Queued (\${index + 1})...</div>
					</div>
					<div class="prompt">\${index + 1}. \${escapeHTML(prompt)}</div>
				\`;
				gallery.appendChild(card);
			});

			// Process images sequentially (prevents crashing / worker freezing)
			for (let i = 0; i < prompts.length; i++) {
				await generateImage(prompts[i], i);
			}

			generateBtn.disabled = false;
			generateBtn.textContent = "Generate Images";
		}

		async function generateImage(prompt, index) {
			const container = document.getElementById("image-" + index);
			container.innerHTML = \`<div class="loading">Generating image \${index + 1}...</div>\`;

			try {
				const response = await fetch("/generate", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ prompt })
				});

				const data = await response.json();

				if (!response.ok || !data.success) {
					throw new Error(data.error || "Generation failed");
				}

				const img = new Image();
				img.src = "data:image/png;base64," + data.image;
				img.alt = "Generated image " + (index + 1);

				container.innerHTML = "";
				container.appendChild(img);
				loadedImages[index] = img;

			} catch (error) {
				console.error("Image " + (index + 1) + " failed:", error);
				container.innerHTML = \`<div class="error">\${error.message || "Failed"}</div>\`;
			}
		}

		function toggleSelect(index) {
			if (!loadedImages[index]) return;

			const card = document.getElementById("card-" + index);

			if (selectedIndices.has(index)) {
				selectedIndices.delete(index);
				card.classList.remove("selected");
			} else {
				selectedIndices.add(index);
				card.classList.add("selected");
			}

			updateCompileButton();
		}

		function updateCompileButton() {
			const count = selectedIndices.size;
			document.getElementById("selectedCount").textContent = count;
			document.getElementById("compileBtn").disabled = count < 5;
		}

		async function compileToMP4() {
			if (selectedIndices.size < 5) {
				alert("Please select at least 5 images!");
				return;
			}

			const videoContainer = document.getElementById("videoContainer");
			videoContainer.innerHTML = "<h3>Compiling video... Please wait.</h3>";

			const canvas = document.createElement("canvas");
			canvas.width = 1280;
			canvas.height = 720;
			const ctx = canvas.getContext("2d");

			const stream = canvas.captureStream(30);
			
			let mimeType = "video/mp4";
			if (!MediaRecorder.isTypeSupported(mimeType)) {
				mimeType = "video/webm;codecs=vp9";
			}

			const recorder = new MediaRecorder(stream, { mimeType });
			const chunks = [];

			recorder.ondataavailable = (e) => chunks.push(e.data);
			recorder.onstop = () => {
				const blob = new Blob(chunks, { type: mimeType });
				const videoUrl = URL.createObjectURL(blob);

				videoContainer.innerHTML = \`
					<h2>Compiled Video</h2>
					<video src="\${videoUrl}" controls autoplay></video>
					<br><br>
					<a href="\${videoUrl}" download="generated-slideshow.\${mimeType.includes("mp4") ? "mp4" : "webm"}" style="color: #10b981; font-weight: bold;">Download Video File</a>
				\`;
			};

			recorder.start();

			const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);

			// Render each selected image for 2 seconds (60 frames at 30 fps)
			for (const idx of sortedIndices) {
				const img = loadedImages[idx];
				for (let frame = 0; frame < 60; frame++) {
					ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
					await new Promise((resolve) => setTimeout(resolve, 1000 / 30));
				}
			}

			recorder.stop();
		}

		function escapeHTML(str) {
			return str.replace(/[&<>'"]/g, 
				tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
			);
		}
	</script>

</body>
</html>
	`;
							}
