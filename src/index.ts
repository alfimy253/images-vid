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
		 * Accepts dynamic prompt in request body
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

				return new Response(
					result as ReadableStream,
					{
						status: 200,
						headers: {
							"Content-Type": "image/png",
							"Cache-Control": "no-store"
						}
					}
				);
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
 * HTML page with dynamic 30-prompt input, minimum selection validation, and MP4 generation.
 */
function createHTML(): string {
	return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>30 Prompt AI Image to MP4 Generator</title>

	<style>
		* {
			box-sizing: border-box;
		}

		body {
			margin: 0;
			padding: 24px;
			background: #111;
			color: white;
			font-family: Arial, sans-serif;
		}

		h1 {
			text-align: center;
			margin: 0 0 20px;
		}

		.input-section {
			max-width: 900px;
			margin: 0 auto 30px auto;
			background: #222;
			padding: 20px;
			border-radius: 10px;
		}

		textarea {
			width: 100%;
			height: 180px;
			background: #181818;
			color: #fff;
			border: 1px solid #333;
			border-radius: 7px;
			padding: 12px;
			font-family: monospace;
			font-size: 13px;
			resize: vertical;
		}

		.actions {
			display: flex;
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
		}

		.gallery {
			display: grid;
			grid-template-columns: repeat(4, 1fr);
			gap: 20px;
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
			font-size: 14px;
		}

		.error {
			color: #ff5555;
			font-size: 13px;
			text-align: center;
			padding: 10px;
		}

		.prompt {
			margin-top: 10px;
			font-size: 13px;
			line-height: 1.4;
			color: #bbb;
			max-height: 40px;
			overflow: hidden;
			text-overflow: ellipsis;
		}

		.video-preview {
			max-width: 900px;
			margin: 30px auto;
			text-align: center;
		}

		video {
			width: 100%;
			border-radius: 10px;
			background: #000;
		}

		@media (max-width: 1000px) {
			.gallery {
				grid-template-columns: repeat(2, 1fr);
			}
		}

		@media (max-width: 600px) {
			body {
				padding: 12px;
			}
			.gallery {
				grid-template-columns: 1fr;
			}
			.actions {
				flex-direction: column;
				align-items: stretch;
			}
		}
	</style>
</head>

<body>

	<h1>AI Image to MP4 Generator</h1>

	<div class="input-section">
		<label for="promptInput" style="display:block; margin-bottom: 8px; font-weight: bold;">
			Enter your 30 Prompts (1 line per prompt):
		</label>
		<textarea id="promptInput" placeholder="Enter prompt 1...&#10;Enter prompt 2...&#10;Enter prompt 3..."></textarea>
		
		<div class="actions">
			<button id="generateBtn" onclick="startBatch()">Generate All Images</button>
			
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
				alert("Please enter at least one prompt.");
				return;
			}

			const prompts = lines.slice(0, 30);
			const gallery = document.getElementById("gallery");
			gallery.innerHTML = "";
			selectedIndices.clear();
			loadedImages = {};
			updateCompileButton();

			/*
			 * Create cards immediately.
			 */
			prompts.forEach((prompt, index) => {
				const card = document.createElement("div");
				card.className = "card";
				card.id = "card-" + index;
				card.onclick = () => toggleSelect(index);

				const overlay = document.createElement("div");
				overlay.className = "select-overlay";
				overlay.id = "check-" + index;
				overlay.textContent = "✓";

				const container = document.createElement("div");
				container.className = "image-container";
				container.id = "image-" + index;

				const loading = document.createElement("div");
				loading.className = "loading";
				loading.textContent = "Generating image " + (index + 1) + "...";
				container.appendChild(loading);

				const promptElement = document.createElement("div");
				promptElement.className = "prompt";
				promptElement.textContent = (index + 1) + ". " + prompt;

				card.appendChild(overlay);
				card.appendChild(container);
				card.appendChild(promptElement);
				gallery.appendChild(card);
			});

			/*
			 * Process image generation in queue.
			 */
			const queue = prompts.map((prompt, index) => ({ prompt, index }));
			const concurrency = 3;

			async function worker() {
				while (queue.length > 0) {
					const item = queue.shift();
					await generateImage(item.prompt, item.index);
				}
			}

			for (let i = 0; i < concurrency; i++) {
				worker();
			}
		}

		async function generateImage(prompt, index) {
			const container = document.getElementById("image-" + index);

			try {
				const response = await fetch("/generate", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ prompt })
				});

				if (!response.ok) {
					throw new Error("Generation failed");
				}

				const blob = await response.blob();
				const imageURL = URL.createObjectURL(blob);

				const img = new Image();
				img.src = imageURL;
				img.alt = "Generated image " + (index + 1);

				container.innerHTML = "";
				container.appendChild(img);

				// Cache image element for rendering video canvas
				loadedImages[index] = img;

			} catch (error) {
				console.error("Image " + (index + 1) + " failed:", error);
				container.innerHTML = '<div class="error">Generation failed</div>';
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
					<a href="\${videoUrl}" download="generated-slideshow.\${mimeType.includes("mp4") ? "mp4" : "webm"}" style="color: #10b981;">Download Video File</a>
				\`;
			};

			recorder.start();

			// Draw each selected image onto canvas for 2 seconds (60 frames at 30 fps)
			const sortedIndices = Array.from(selectedIndices).sort((a, b) => a - b);

			for (const idx of sortedIndices) {
				const img = loadedImages[idx];
				for (let frame = 0; frame < 60; frame++) {
					ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
					await new Promise((resolve) => setTimeout(resolve, 1000 / 30));
				}
			}

			recorder.stop();
		}
	</script>

</body>
</html>
	`;
		}
