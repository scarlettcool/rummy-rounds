<script setup lang="ts">
import { ref } from 'vue'
import UiIcon from './UiIcon.vue'
const dialog = ref<HTMLDialogElement>()
</script>

<template>
  <button class="text-button help-trigger" type="button" @click="dialog?.showModal()"><UiIcon name="help" />玩法说明</button>
  <dialog ref="dialog" class="help-dialog" aria-labelledby="help-title" @click.self="dialog?.close()">
    <div class="help-content">
      <header><span class="eyebrow">HOW TO PLAY</span><button autofocus class="icon-button" aria-label="关闭说明" @click="dialog?.close()"><UiIcon name="close" /></button></header>
      <h2 id="help-title">先熟悉一轮出牌</h2>
      <p>当前为单人摸牌与弃牌练习，可反复熟悉操作。</p>
      <ol>
        <li><b>摸一张牌</b><span>点击牌堆或「摸牌」，手牌由 10 张变为 11 张。</span></li>
        <li><b>选择一张</b><span>点击手牌选中，再次点击可取消。可用理牌整理顺序。</span></li>
        <li><b>弃牌结束回合</b><span>确认弃牌后保持 10 张，开始下一回合。</span></li>
      </ol>
      <p class="help-note">108 张牌：四色 1–12 数字牌各两张、8 张万能牌、4 张跳过牌。组牌、特殊牌效果、计分与多人对局尚未开放。</p>
      <button class="primary-button" @click="dialog?.close()">开始练习<UiIcon name="arrow" /></button>
    </div>
  </dialog>
</template>
