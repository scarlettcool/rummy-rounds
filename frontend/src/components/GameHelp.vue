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
      <p>大厅提供数字组牌挑战和自由练习，两种牌桌均为单人模式。</p>
      <p class="help-goal"><b>挑战目标：两组三张同点数字牌</b><br>每组不限颜色，六张同点牌也可拆成两组。每张牌只能使用一次。起手或弃牌后手牌为 10 张时，可点击「提交组合」完成挑战；结果保存后可以开始下一局。</p>
      <ol>
        <li><b>摸一张牌</b><span>点击牌堆或「摸牌」，手牌由 10 张变为 11 张。</span></li>
        <li><b>选择一张</b><span>点击手牌选中，再次点击可取消。可用理牌整理顺序。</span></li>
        <li><b>弃牌结束回合</b><span>确认弃牌后保持 10 张，开始下一回合。</span></li>
      </ol>
      <p>组合参考：同点数字 3 张起，连续数字 4 张起（不限颜色，1 与 12 不首尾相连）。每张牌只用于一个建议，优先覆盖更多手牌。点击建议可高亮对应手牌，不会自动选中弃牌。</p>
      <p class="help-note">108 张牌：四色 1–12 数字牌各两张、8 张万能牌、4 张跳过牌。当前挑战只使用数字牌；万能牌暂不替代，跳过牌不触发效果，可正常弃掉。连号属于自由练习提示，不计入本次同点挑战。完整阶段赛、积分赛与多人对局尚未开放。</p>
      <div class="help-actions"><button class="primary-button" @click="dialog?.close()">明白了<UiIcon name="check" /></button></div>
    </div>
  </dialog>
</template>
