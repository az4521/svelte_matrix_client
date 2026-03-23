<script lang="ts">
	import type { Room } from 'matrix-js-sdk';
	import { getClient, onSyncPrepared } from '$lib/matrix/client';
	import { getMessages } from '$lib/stores/messages.svelte';
	import { tick } from 'svelte';

	interface Props {
		room: Room;
	}

	let { room }: Props = $props();

	let visible = $state(false);
	let refreshTick = $state(0);

	function refresh() {
		refreshTick++;
	}

	// Keyboard shortcut: Ctrl+Shift+D
	function onKeydown(e: KeyboardEvent) {
		if (e.ctrlKey && e.shiftKey && e.key === 'D') {
			e.preventDefault();
			visible = !visible;
			if (visible) refresh();
		}
	}

	const syncState = $derived.by(() => {
		refreshTick;
		return getClient()?.getSyncState() ?? 'N/A';
	});

	const allTimelineEvents = $derived.by(() => {
		refreshTick;
		return room.getLiveTimeline().getEvents();
	});

	const pendingEvents = $derived.by(() => {
		refreshTick;
		try {
			return room.getPendingEvents();
		} catch {
			return [];
		}
	});

	const filteredMessages = $derived.by(() => {
		refreshTick;
		return getMessages(room.roomId);
	});

	function statusLabel(status: string | null | undefined): string {
		if (!status) return 'confirmed';
		return String(status);
	}

	function eventSummary(e: ReturnType<typeof room.getLiveTimeline>['getEvents'][0]) {
		const type = e.getType();
		const sender = e.getSender() ?? '?';
		const id = e.getId() ?? '?';
		const ts = e.getTs();
		const isRedacted = e.isRedacted();
		const status = statusLabel((e as any).status);
		const content = e.getContent();
		const relType = content?.['m.relates_to']?.rel_type ?? null;
		return { type, sender, id, ts, isRedacted, status, content, relType };
	}

	function formatTs(ts: number): string {
		if (!ts) return '-';
		return new Date(ts).toLocaleTimeString();
	}

	function msgPreview(content: Record<string, unknown>): string {
		const body = content?.body as string | undefined;
		if (!body) return JSON.stringify(content).slice(0, 80);
		return body.slice(0, 60) + (body.length > 60 ? '…' : '');
	}

	let copyDone = $state(false);
	function copyReport() {
		const lines: string[] = [];
		lines.push(`=== DEBUG REPORT ===`);
		lines.push(`Room: ${room.roomId}`);
		lines.push(`Sync state: ${syncState}`);
		lines.push(`\n--- TIMELINE (${allTimelineEvents.length} events) ---`);
		for (const e of allTimelineEvents) {
			const s = eventSummary(e);
			lines.push(`[${formatTs(s.ts)}] ${s.type} | ${s.sender} | status=${s.status} | redacted=${s.isRedacted} | relType=${s.relType ?? '-'} | id=${s.id}`);
			lines.push(`  body: ${msgPreview(s.content)}`);
		}
		lines.push(`\n--- PENDING EVENTS (${pendingEvents.length}) ---`);
		for (const e of pendingEvents) {
			const s = eventSummary(e);
			lines.push(`[${formatTs(s.ts)}] ${s.type} | ${s.sender} | status=${s.status} | id=${s.id}`);
			lines.push(`  body: ${msgPreview(s.content)}`);
		}
		lines.push(`\n--- STORE MESSAGES (${filteredMessages.length}) ---`);
		for (const e of filteredMessages) {
			const s = eventSummary(e);
			lines.push(`[${formatTs(s.ts)}] ${s.type} | ${s.sender} | status=${s.status} | id=${s.id}`);
			lines.push(`  body: ${msgPreview(s.content)}`);
		}
		navigator.clipboard.writeText(lines.join('\n'));
		copyDone = true;
		setTimeout(() => copyDone = false, 2000);
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if visible}
	<div class="fixed inset-0 z-[9999] flex items-stretch pointer-events-none">
		<!-- Click-away overlay -->
		<div class="absolute inset-0 bg-black/40 pointer-events-auto" role="presentation" onclick={() => visible = false}></div>

		<!-- Panel -->
		<div class="relative ml-auto w-[600px] max-w-[90vw] bg-[#1a1a2e] text-[#e0e0e0] flex flex-col shadow-2xl pointer-events-auto overflow-hidden">
			<!-- Header -->
			<div class="flex items-center justify-between px-3 py-2 bg-[#0d0d1a] border-b border-[#333] flex-shrink-0">
				<span class="font-mono text-xs font-bold text-yellow-400">DEBUG PANEL</span>
				<div class="flex items-center gap-2">
					<span class="font-mono text-xs text-gray-400">Sync: <span class="text-green-400">{syncState}</span></span>
					<button onclick={refresh} class="text-xs px-2 py-0.5 rounded bg-[#2a2a4a] hover:bg-[#3a3a5a] font-mono">↻ refresh</button>
					<button onclick={copyReport} class="text-xs px-2 py-0.5 rounded bg-[#2a4a2a] hover:bg-[#3a5a3a] font-mono">
						{copyDone ? '✓ copied' : '⧉ copy'}
					</button>
					<button onclick={() => visible = false} class="text-xs px-2 py-0.5 rounded bg-[#4a2a2a] hover:bg-[#5a3a3a] font-mono">✕</button>
				</div>
			</div>

			<div class="flex-1 overflow-y-auto font-mono text-xs">
				<!-- Store messages -->
				<section>
					<div class="sticky top-0 px-3 py-1 bg-[#0d1a0d] border-b border-[#333] text-green-400 font-bold">
						STORE MESSAGES ({filteredMessages.length}) — what the UI renders
					</div>
					{#each filteredMessages as e, i}
						{@const s = eventSummary(e)}
						<div class="px-3 py-1 border-b border-[#222] hover:bg-[#1f1f3a]">
							<div class="flex gap-2 items-baseline">
								<span class="text-gray-500">{i}</span>
								<span class="text-yellow-300">{formatTs(s.ts)}</span>
								<span class="text-blue-300">{s.type}</span>
								<span class="text-purple-300">{s.sender.split(':')[0]}</span>
								<span class="px-1 rounded text-[10px]" class:bg-green-900={s.status === 'confirmed'} class:bg-yellow-900={s.status !== 'confirmed'}>
									{s.status}
								</span>
								{#if s.isRedacted}<span class="text-red-400">REDACTED</span>{/if}
								{#if s.relType}<span class="text-orange-400">rel={s.relType}</span>{/if}
							</div>
							<div class="text-gray-400 pl-4 truncate">{msgPreview(s.content)}</div>
							<div class="text-gray-600 pl-4 text-[10px] truncate">{s.id}</div>
						</div>
					{/each}
					{#if filteredMessages.length === 0}
						<div class="px-3 py-2 text-gray-600 italic">empty</div>
					{/if}
				</section>

				<!-- Pending events -->
				<section>
					<div class="sticky top-0 px-3 py-1 bg-[#1a0d0d] border-b border-[#333] text-red-400 font-bold">
						PENDING EVENTS ({pendingEvents.length})
					</div>
					{#each pendingEvents as e, i}
						{@const s = eventSummary(e)}
						<div class="px-3 py-1 border-b border-[#222] hover:bg-[#1f1f3a]">
							<div class="flex gap-2 items-baseline flex-wrap">
								<span class="text-gray-500">{i}</span>
								<span class="text-yellow-300">{formatTs(s.ts)}</span>
								<span class="text-blue-300">{s.type}</span>
								<span class="text-purple-300">{s.sender.split(':')[0]}</span>
								<span class="px-1 rounded text-[10px] bg-yellow-900">{s.status}</span>
								{#if s.relType}<span class="text-orange-400">rel={s.relType}</span>{/if}
							</div>
							<div class="text-gray-400 pl-4 truncate">{msgPreview(s.content)}</div>
							<div class="text-gray-600 pl-4 text-[10px] truncate">{s.id}</div>
						</div>
					{/each}
					{#if pendingEvents.length === 0}
						<div class="px-3 py-2 text-gray-600 italic">empty</div>
					{/if}
				</section>

				<!-- Full raw timeline -->
				<section>
					<div class="sticky top-0 px-3 py-1 bg-[#0d0d1a] border-b border-[#333] text-blue-400 font-bold">
						RAW TIMELINE ({allTimelineEvents.length} events)
					</div>
					{#each allTimelineEvents as e, i}
						{@const s = eventSummary(e)}
						<div class="px-3 py-1 border-b border-[#1a1a1a] hover:bg-[#1f1f3a]">
							<div class="flex gap-2 items-baseline flex-wrap">
								<span class="text-gray-500">{i}</span>
								<span class="text-yellow-300">{formatTs(s.ts)}</span>
								<span class:text-blue-300={s.type === 'm.room.message'} class:text-gray-500={s.type !== 'm.room.message'}>
									{s.type}
								</span>
								<span class="text-purple-300">{s.sender.split(':')[0]}</span>
								{#if s.status !== 'confirmed'}<span class="px-1 rounded text-[10px] bg-yellow-900">{s.status}</span>{/if}
								{#if s.isRedacted}<span class="text-red-400">REDACTED</span>{/if}
								{#if s.relType}<span class="text-orange-400">rel={s.relType}</span>{/if}
							</div>
							{#if s.type === 'm.room.message' || s.type === 'm.sticker'}
								<div class="text-gray-400 pl-4 truncate">{msgPreview(s.content)}</div>
							{/if}
							<div class="text-gray-600 pl-4 text-[10px] truncate">{s.id}</div>
						</div>
					{/each}
				</section>
			</div>
		</div>
	</div>
{/if}
