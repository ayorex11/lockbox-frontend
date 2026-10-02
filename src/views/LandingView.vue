<script setup lang="ts">
import { useRouter } from 'vue-router'
import BaseButton from '@/components/BaseButton.vue'
import DropZone from '@/components/DropZone.vue'
import Icon from '@/components/Icon.vue'
import { usePendingFileStore } from '@/stores/pending'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const pending = usePendingFileStore()
const auth = useAuthStore()

function onSelect(file: File) {
  pending.file = file
  void router.push({ name: 'send' }) // the auth guard sends signed-out visitors through login first
}

const steps = [
  { icon: 'lock', title: 'Lock it', body: 'Pick your file. It is locked inside your browser before anything is uploaded.', tag: 'Key created on your device', tagIcon: 'key' },
  { icon: 'link', title: 'Share the link', body: 'Send the private link by chat, email or message. The key is part of the link itself.', tag: 'Key never reaches our servers', tagIcon: 'visibility_off' },
  { icon: 'local_fire_department', title: 'It expires or self-destructs', body: 'Set a time limit, or make it vanish after one download. Then the file is deleted.', tag: 'Automatic cleanup', tagIcon: 'auto_delete' },
]
const benefits = [
  { icon: 'shield_lock', title: 'Locked on your device', body: 'Your file is encrypted before it leaves your computer. We only ever store scrambled data.', tag: 'End-to-end encrypted contents' },
  { icon: 'timer', title: 'Links that expire', body: 'Choose 1 hour, 24 hours or 7 days, limit the number of downloads, or use a one-time link.', tag: 'Self-destruct after one download' },
  { icon: 'visibility', title: 'See who opened it', body: 'Follow when your link was opened and downloaded, and switch it off any time.', tag: 'One-click revoke' },
]
const canSee = ['The file name and size', 'When the link was opened or downloaded', 'The approximate network of whoever opened it (shortened, never the full address)']
const cannotSee = ['What is inside your file', 'The key that unlocks it, which lives after the # in your link and is never sent to a server']
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="container-page pb-10 pt-14 text-center sm:pt-20">
      <span class="inline-flex items-center gap-2 rounded-full border border-outline-variant/60 bg-surface-container-lowest px-3 py-1 text-xs font-medium text-on-surface-variant shadow-sm">
        <span class="h-1.5 w-1.5 rounded-full bg-primary" /> Simple · Free · Recipients never need an account
      </span>
      <h1 class="mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-[-0.03em] sm:text-5xl">
        Send files privately. Only the person with the link can open them.
      </h1>
      <p class="mx-auto mt-5 max-w-xl text-lg text-on-surface-variant">
        Your file is locked on your device before it's uploaded. Not even Lockbox can read what's inside.
      </p>
      <div class="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <BaseButton :to="{ name: 'send' }" size="lg" icon-right="arrow_forward">Send a file</BaseButton>
        <BaseButton v-if="!auth.isAuthenticated" :to="{ name: 'login' }" size="lg" variant="secondary">Log in</BaseButton>
        <BaseButton v-else :to="{ name: 'dashboard' }" size="lg" variant="secondary">My files</BaseButton>
      </div>
      <p class="hint mt-4">Up to 25 MB per file · A free account is needed to send</p>

      <div class="card mx-auto mt-12 max-w-2xl p-3">
        <DropZone @select="onSelect" />
      </div>
    </section>

    <!-- How it works -->
    <section id="how-it-works" class="scroll-mt-20 bg-surface-container-low py-16">
      <div class="container-page">
        <p class="eyebrow text-center">How it works</p>
        <h2 class="mt-2 text-center text-3xl font-semibold tracking-tight">Three simple steps to total privacy.</h2>
        <div class="mt-10 grid gap-5 md:grid-cols-3">
          <article v-for="(step, i) in steps" :key="step.title" class="card flex flex-col p-6">
            <div class="flex items-start justify-between">
              <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container text-primary"><Icon :name="step.icon" /></span>
              <span class="font-mono text-sm text-outline">0{{ i + 1 }}</span>
            </div>
            <h3 class="mt-5 text-lg font-semibold">{{ step.title }}</h3>
            <p class="mt-1.5 flex-1 text-[15px] text-on-surface-variant">{{ step.body }}</p>
            <p class="mt-4 flex items-center gap-1.5 font-mono text-xs text-primary"><Icon :name="step.tagIcon" :size="14" />{{ step.tag }}</p>
          </article>
        </div>
      </div>
    </section>

    <!-- Benefits -->
    <section class="container-page py-16">
      <h2 class="text-center text-3xl font-semibold tracking-tight">Built for peace of mind, not complexity.</h2>
      <p class="mx-auto mt-3 max-w-xl text-center text-on-surface-variant">Simple enough for contracts and ID scans. Serious enough for things you would not email.</p>
      <div class="mt-10 grid gap-5 md:grid-cols-3">
        <article v-for="b in benefits" :key="b.title" class="card flex flex-col overflow-hidden">
          <div class="flex-1 p-6">
            <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-fixed text-on-primary-fixed-variant"><Icon :name="b.icon" /></span>
            <h3 class="mt-5 text-lg font-semibold">{{ b.title }}</h3>
            <p class="mt-1.5 text-[15px] text-on-surface-variant">{{ b.body }}</p>
          </div>
          <p class="border-t border-outline-variant/40 bg-surface-container-low px-6 py-3 font-mono text-xs text-primary">{{ b.tag }}</p>
        </article>
      </div>
    </section>

    <!-- Security, stated plainly -->
    <section id="security" class="scroll-mt-20 bg-surface-container-low py-16">
      <div class="container-page">
        <p class="eyebrow text-center">Security</p>
        <h2 class="mt-2 text-center text-3xl font-semibold tracking-tight">What Lockbox can and can't see.</h2>
        <div class="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-2">
          <div class="card p-6">
            <h3 class="flex items-center gap-2 font-semibold"><Icon name="visibility" class="text-on-surface-variant" /> What we can see</h3>
            <ul class="mt-4 space-y-3 text-[15px] text-on-surface-variant">
              <li v-for="item in canSee" :key="item" class="flex gap-2"><Icon name="check" :size="18" class="mt-0.5 text-outline" />{{ item }}</li>
            </ul>
          </div>
          <div class="card border-primary/40 p-6">
            <h3 class="flex items-center gap-2 font-semibold"><Icon name="visibility_off" class="text-primary" /> What we can't see</h3>
            <ul class="mt-4 space-y-3 text-[15px] text-on-surface-variant">
              <li v-for="item in cannotSee" :key="item" class="flex gap-2"><Icon name="lock" fill :size="18" class="mt-0.5 text-primary" />{{ item }}</li>
            </ul>
          </div>
        </div>
        <div class="mx-auto mt-5 max-w-4xl rounded-2xl bg-surface-container-low p-5 text-[14px] leading-relaxed text-on-surface-variant">
          <p class="flex gap-2"><Icon name="info" :size="18" class="mt-0.5 shrink-0 text-outline" /><span><strong class="text-on-surface">Good to know.</strong> Anyone who has your full link can open the file, unless you add a password. Before the password step they can see the file name and size, and your email if you chose to show it. If you send a link by email, add a password and share it on a different channel, so a compromised inbox alone can't unlock the file.</span></p>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="container-page py-16">
      <div class="card flex flex-col items-start justify-between gap-6 p-8 sm:flex-row sm:items-center sm:p-10">
        <div>
          <h2 class="text-2xl font-semibold tracking-tight">Ready to share securely?</h2>
          <p class="mt-1 text-on-surface-variant">Free to use. Takes less than a minute.</p>
        </div>
        <BaseButton :to="{ name: 'send' }" size="lg" icon-right="arrow_forward">Send your first file</BaseButton>
      </div>
    </section>
  </div>
</template>
