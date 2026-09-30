<template>
  <section class="teacher-page">
    <nav class="teacher-tabs" aria-label="教师统计页面" role="tablist">
      <button v-for="tab in tabs" :key="tab.id" class="teacher-tab" :class="{ 'teacher-tab-active': activeTab === tab.id }" :aria-selected="activeTab === tab.id" role="tab" @click="setActiveTab(tab.id)">{{ tab.label }}</button>
    </nav>

    <article v-show="activeTab === 'groups'" class="panel-card teacher-panel groups-panel">
      <div class="section-head"><h3>小组试验结果统计图</h3></div>
      <div class="group-grid">
        <div v-for="group in groupsOverview" :key="group.group_id" class="mini-card">
          <div class="mini-head"><span class="mini-title">{{ group.group_name }}</span></div>
          <div class="mini-chart" :ref="setMiniChartRef(group.group_id)"></div>
          <div class="mini-summary-row">
            <div class="mini-summary-chip mini-a-chip">{{ getMiniSummaryText(group, 'a') }}</div>
            <div class="mini-summary-chip mini-b-chip">{{ getMiniSummaryText(group, 'b') }}</div>
            <div class="mini-summary-chip mini-winner-chip" :class="miniWinnerClass(group.winner)">{{ getMiniSummaryText(group, 'winner') }}</div>
          </div>
        </div>
      </div>
    </article>

    <article v-show="activeTab === 'class'" class="panel-card teacher-panel class-panel">
      <div class="section-head"><h3>全班试验结果统计图</h3></div>
      <div class="class-overview-row">
        <div ref="classChartRef" class="class-chart"></div>
        <div class="class-group-list-panel">
          <label v-for="group in groupsOverview" :key="`class-group-${group.group_id}`" class="class-group-list-item">
            <input type="checkbox" :checked="selectedGroupIds.includes(group.group_id)" @change="toggleGroup(group.group_id, $event)" />
            <span class="class-group-list-text">{{ group.group_name }}</span>
          </label>
        </div>
      </div>
      <div class="class-stats-row">
        <article class="class-stat-card class-a-card"><span class="class-stat-icon">●</span><p class="class-stat-line">掷到A组：{{ Number(classSummary.group_a_total ?? 0) }}次</p></article>
        <article class="class-stat-card class-b-card"><span class="class-stat-icon">●</span><p class="class-stat-line">掷到B组：{{ Number(classSummary.group_b_total ?? 0) }}次</p></article>
        <article class="class-stat-card class-winner-card" :class="classWinnerCardClass(classSummary.winner)"><span class="class-stat-icon class-flag">🚩</span><p class="class-stat-line">{{ winnerText(classSummary.winner) }}</p></article>
      </div>
    </article>

    <article v-show="activeTab === 'simulation'" class="panel-card teacher-panel simulation-panel" ref="simulationPanelRef">
      <div class="section-head"><h3>大数据试验统计</h3></div>
      <div class="sim-controls">
        <input v-model="simulationInput" type="number" min="1" class="sim-input" placeholder="请输入模拟次数" />
        <button @click="runSimulationAndDice" :disabled="simulating || isDiceRolling" class="sim-btn">{{ (simulating || isDiceRolling) ? '模拟中...' : '开始模拟' }}</button>
      </div>
      <div class="sim-table-wrap">
        <table class="sim-table"><tbody>
          <tr><th>点数和</th><td v-for="item in simulationDisplayRecords" :key="`num-${item.number}`">{{ item.number }}</td></tr>
          <tr><th>次数</th><td v-for="item in simulationDisplayRecords" :key="`cnt-${item.number}`" :class="[2, 3, 4, 10, 11, 12].includes(item.number) ? 'sim-count-a' : 'sim-count-b'" :style="getSimulationTableCountStyle()">{{ item.count }}</td></tr>
        </tbody></table>
      </div>
      <div class="sim-visual-row">
        <div ref="simChartRef" class="sim-chart"></div>
        <div class="dice-panel"><div class="dice-2d-wrap">
          <video ref="diceVideoRef" class="dice-video" :src="diceVideoSrc" :poster="dicePosterDataUrl" @error="onDiceVideoError" @loadedmetadata="onDiceVideoLoadedMetadata" playsinline webkit-playsinline="true" x5-playsinline="true" x5-video-player-type="h5" preload="auto"></video>
          <div v-if="diceVideoLoadFailed" class="dice-video-fallback">视频加载失败</div>
        </div></div>
      </div>
      <div class="class-stats-row">
        <article class="class-stat-card class-a-card"><span class="class-stat-icon">●</span><p class="class-stat-line">掷到A组：{{ Number(simulationDisplayGroupATotal ?? 0) }}次</p></article>
        <article class="class-stat-card class-b-card"><span class="class-stat-icon">●</span><p class="class-stat-line">掷到B组：{{ Number(simulationDisplayGroupBTotal ?? 0) }}次</p></article>
        <article class="class-stat-card class-winner-card" :class="classWinnerCardClass(simulationData.winner)"><span class="class-stat-icon class-flag">🚩</span><p class="class-stat-line">{{ winnerText(simulationData.winner) }}</p></article>
      </div>
    </article>

    <div v-if="activeTab === 'simulation' && pendingComparisonSimulation" class="pending-simulation">
      <span>两次对比结果已保存。请选择替换项：</span>
      <button class="sim-btn" @click="saveSimulationToSlot(0)">替换试验一</button>
      <button class="sim-btn" @click="saveSimulationToSlot(1)">替换试验二</button>
      <button class="secondary-btn" @click="pendingComparisonSimulation = null">取消</button>
    </div>

    <article v-show="activeTab === 'comparison'" class="panel-card teacher-panel comparison-panel">
      <div class="section-head comparison-heading"><h3>对比图</h3></div>
      <div class="comparison-grid">
        <section class="comparison-item"><h4>小组试验结果统计图</h4>
          <div class="group-grid comparison-groups">
            <div v-for="group in comparisonData.groups" :key="`comparison-${group.group_id}`" class="mini-card">
              <div class="mini-head"><span class="mini-title">{{ group.group_name }}</span></div>
              <div class="mini-chart" :ref="setComparisonMiniChartRef(group.group_id)"></div>

            </div>
          </div>
        </section>
        <section class="comparison-item"><h4>全班试验结果统计图</h4><div ref="comparisonClassChartRef" class="class-chart"></div></section>
        <section v-for="(run, index) in comparisonData.simulations" :key="`run-${index}`" class="comparison-item">
          <h4>大数据试验{{ index + 1 }}</h4>
          <template v-if="run"><div :ref="setComparisonSimulationChartRef(index)" class="comparison-sim-chart"></div><p class="comparison-total">模拟次数：{{ run.total_times }} 次</p></template>
          <p v-else class="comparison-empty">尚未保存该次模拟。请在“大数据试验统计”中运行模拟。</p>
        </section>
      </div>
    </article>

    <p v-if="error" class="error-text">{{ error }}</p>
  </section>
</template>

<script>
import axios from '../lib/http'
import * as echarts from 'echarts'
import { markRaw } from 'vue'
import { io } from 'socket.io-client'
import {
  GROUP_A_NUMBERS,
  GROUP_B_NUMBERS,
  buildMiniChartOption,
  buildClassChartOption,
  buildSimulationChartOption
} from '../utils/charts'

const yaotouziBundledVideoSrc = new URL('../assets/yaotouzi.mp4', import.meta.url).href
const daziAudioSrc = new URL('../assets/dazi.mp3', import.meta.url).href
const yaotouziVideoSrcCandidates = [
  yaotouziBundledVideoSrc
]
const dicePosterSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#e2e8f0"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg)"/>
  <rect x="190" y="70" width="120" height="120" rx="22" fill="#fff" stroke="#cbd5e1" stroke-width="6"/>
  <rect x="330" y="160" width="120" height="120" rx="22" fill="#fff" stroke="#cbd5e1" stroke-width="6"/>
  <circle cx="225" cy="105" r="10" fill="#D92121"/>
  <circle cx="275" cy="155" r="10" fill="#D92121"/>
  <circle cx="365" cy="195" r="10" fill="#0f172a"/>
  <circle cx="415" cy="245" r="10" fill="#0f172a"/>
  <text x="320" y="325" text-anchor="middle" fill="#475569" font-size="24" font-family="Arial, sans-serif">
    Dice Preview
  </text>
</svg>
`
const dicePosterDataUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(dicePosterSvg)}`

export default {
  name: 'TeacherView',
  data() {
    return {
      tabs: [
        { id: 'groups', label: '小组试验结果统计图' },
        { id: 'class', label: '全班试验结果统计图' },
        { id: 'simulation', label: '大数据试验统计' },
        { id: 'comparison', label: '对比图' }
      ],
      activeTab: 'groups',
      groupsOverview: [],
      comparisonData: { groups: [], classSummary: null, simulations: [null, null] },
      isUpdatingComparison: false,
      pendingComparisonSimulation: null,
      comparisonMiniCharts: {},
      comparisonMiniChartEls: {},
      comparisonClassChart: null,
      comparisonSimulationCharts: {},
      comparisonSimulationChartEls: {},
      simulationInput: '',
      simulationData: {
        records: Array.from({ length: 11 }, (_, idx) => ({ number: idx + 2, count: 0 })),
        group_a_total: 0,
        group_b_total: 0,
        winner: 'Tie'
      },
      error: '',
      simulating: false,
      isFetchingOverview: false,
      classChart: null,
      simChart: null,
      miniCharts: {},
      miniChartEls: {},
      selectedGroupIds: [],
      overviewRefreshTimer: null,
      hasPendingOverviewRefresh: false,
      hasPendingFullOverviewRefresh: false,
      pendingOverviewGroupIds: [],
      overviewRefreshDelay: 200,
      socket: null,
      simAnimatedRecords: [],
      simulationTimer: null,
      simAnimationAxisStartMax: null,
      simAnimationAxisMax: null,
      simAnimationLabelFontSize: null,
      plannedSimulationDurationMs: 0,
      simulationRenderCount: 0,
      miniSummaryVisibleMap: {},
      miniSummaryDisplayTextMap: {},
      typingAudio: null,
      isDiceRolling: false,
      diceVideoSrcCandidates: yaotouziVideoSrcCandidates,
      diceVideoSrcIndex: 0,
      diceVideoSrc: yaotouziVideoSrcCandidates[0],
      dicePosterDataUrl,
      diceVideoLoadFailed: false,
      hasStartedDiceSimulation: false
    }
  },
  computed: {
    classSummary() {
      const selectedGroups = this.groupsOverview.filter(group => this.selectedGroupIds.includes(group.group_id))
      return this.summarizeGroups(selectedGroups)
    },
    simulationDisplayRecords() {
      if (this.simulating && this.simAnimatedRecords.length) {
        return this.simAnimatedRecords
      }
      return this.simulationData.records
    },
    simulationDisplayGroupATotal() {
      return this.simulationDisplayRecords
        .filter(record => GROUP_A_NUMBERS.includes(record.number))
        .reduce((sum, record) => sum + record.count, 0)
    },
    simulationDisplayGroupBTotal() {
      return this.simulationDisplayRecords
        .filter(record => GROUP_B_NUMBERS.includes(record.number))
        .reduce((sum, record) => sum + record.count, 0)
    }
  },
  methods: {
    summarizeGroups(groups = []) {
      const totals = Object.fromEntries(Array.from({ length: 11 }, (_, index) => [index + 2, 0]))
      groups.forEach(group => (group.records || []).forEach(record => {
        if (Object.prototype.hasOwnProperty.call(totals, record.number)) totals[record.number] += Number(record.count || 0)
      }))
      const records = Object.entries(totals).map(([number, count]) => ({ number: Number(number), count }))
      const groupATotal = records.filter(record => GROUP_A_NUMBERS.includes(record.number)).reduce((sum, record) => sum + record.count, 0)
      const groupBTotal = records.filter(record => GROUP_B_NUMBERS.includes(record.number)).reduce((sum, record) => sum + record.count, 0)
      return { records, group_a_total: groupATotal, group_b_total: groupBTotal, winner: groupATotal === groupBTotal ? 'Tie' : groupATotal > groupBTotal ? 'A' : 'B' }
    },
    setActiveTab(tabId) {
      this.activeTab = tabId
      this.$nextTick(() => {
        if (tabId === 'groups') {
          this.renderMiniCharts()
        }
        if (tabId === 'class') this.renderClassChart()
        if (tabId === 'simulation') {
          if (this.$refs.simulationPanelRef) this.$refs.simulationPanelRef.scrollTop = 0
          this.renderSimulationChart()
        }
        if (tabId === 'comparison') this.updateComparisonData()
        this.onResize()
      })
    },
    setComparisonMiniChartRef(groupId) {
      return el => { if (el) this.comparisonMiniChartEls[groupId] = el }
    },
    setComparisonSimulationChartRef(index) {
      return el => { if (el) this.comparisonSimulationChartEls[index] = el }
    },
    getSimulationDurationMs() {
      return this.simulationRenderCount === 0 ? 8000 : 16000
    },
    ensureDiceFirstFrame(videoEl = this.$refs.diceVideoRef) {
      if (!videoEl || this.hasStartedDiceSimulation) return

      const seekToFirstFrame = () => {
        try {
          videoEl.muted = true
          const playPromise = videoEl.play()
          if (playPromise && typeof playPromise.then === 'function') {
            playPromise
              .then(() => {
                setTimeout(() => {
                  if (this.hasStartedDiceSimulation) return
                  videoEl.pause()
                  const duration = Number(videoEl.duration || 0)
                  const firstFrameTime = duration > 0 ? Math.min(0.05, Math.max(0.001, duration - 0.001)) : 0.001
                  videoEl.currentTime = firstFrameTime
                }, 80)
              })
              .catch(() => {})
          } else {
            videoEl.pause()
            videoEl.currentTime = 0.001
          }
        } catch (_) {
          // Ignore seek failures on some browsers; metadata/canplay will retry.
        }
      }

      if (videoEl.readyState >= 2) {
        seekToFirstFrame()
      } else {
        videoEl.addEventListener('loadeddata', seekToFirstFrame, { once: true })
      }
    },
    syncDiceVideoLoop() {
      const videoEl = this.$refs.diceVideoRef
      if (!videoEl) return

      const durationSeconds = Number(videoEl.duration || 0)
      const plannedSeconds = Number(this.plannedSimulationDurationMs || 0) / 1000
      videoEl.loop = durationSeconds > 0 && plannedSeconds > durationSeconds
    },
    async runSimulationAndDice() {
      if (this.simulating || this.isDiceRolling) return
      const targetTimes = Number(this.simulationInput)
      if (!Number.isInteger(targetTimes) || targetTimes < 1) {
        this.error = '请输入大于 0 的整数次数'
        return
      }
      this.error = ''
      this.plannedSimulationDurationMs = this.getSimulationDurationMs()
      this.simulationRenderCount += 1
      this.startDiceSimulation()
      await this.runSimulation()
    },
    startDiceSimulation() {
      this.isDiceRolling = true
      this.hasStartedDiceSimulation = true
      const videoEl = this.$refs.diceVideoRef
      if (!videoEl) return
      this.diceVideoLoadFailed = false
      videoEl.pause()
      videoEl.currentTime = 0
      videoEl.muted = false
      videoEl.volume = 1
      this.syncDiceVideoLoop()
      const playPromise = videoEl.play()
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {})
      }
    },
    onDiceVideoError() {
      if (this.diceVideoSrcIndex >= this.diceVideoSrcCandidates.length - 1) {
        if (this.hasStartedDiceSimulation) {
          this.diceVideoLoadFailed = true
          this.error = '\u6447\u9ab0\u5b50\u89c6\u9891\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u6216\u89c6\u9891\u683c\u5f0f\u517c\u5bb9\u6027'
        }
        return
      }

      this.diceVideoSrcIndex += 1
      this.diceVideoSrc = this.diceVideoSrcCandidates[this.diceVideoSrcIndex]
      this.diceVideoLoadFailed = false
      this.$nextTick(() => {
        const videoEl = this.$refs.diceVideoRef
        if (!videoEl) return
        videoEl.load()
      })
    },
    onDiceVideoLoadedMetadata(event) {
      const videoEl = event?.target || this.$refs.diceVideoRef
      if (!videoEl) return
      // Tablet browsers may report 0x0 during metadata phase, do not mark as failure here.
      this.diceVideoLoadFailed = false
      this.syncDiceVideoLoop()
      this.ensureDiceFirstFrame(videoEl)
    },
    stopDiceSimulation(shouldResetFrame = true) {
      this.isDiceRolling = false
      const videoEl = this.$refs.diceVideoRef
      if (!videoEl) return
      videoEl.loop = false
      videoEl.pause()
      if (shouldResetFrame) {
        videoEl.currentTime = 0
      }
    },
    setMiniChartRef(groupId) {
      return el => {
        if (el) this.miniChartEls[groupId] = el
      }
    },
    winnerText(winner) {
      if (winner === 'A') return 'A组获胜'
      if (winner === 'B') return 'B组获胜'
      return '平局'
    },
    miniWinnerClass(winner) {
      if (winner === 'A') return 'mini-a-win-chip'
      if (winner === 'B') return 'mini-b-win-chip'
      return 'mini-tie-win-chip'
    },
    classWinnerCardClass(winner) {
      if (winner === 'A') return 'class-winner-a-card'
      if (winner === 'B') return 'class-winner-b-card'
      return 'class-winner-tie-card'
    },
    getAxisInterval(maxValue) {
      if (maxValue <= 10) return 1
      return Math.ceil(maxValue / 10)
    },
    getAxisMaxWithHeadroom(maxValue, minValue = 10) {
      if (maxValue <= minValue) return minValue
      const headroom = Math.max(1, Math.ceil(maxValue * 0.08))
      return maxValue + headroom
    },
    getAdaptiveSimulationValueFontSize(records = this.simulationDisplayRecords) {
      const maxDigits = Math.max(
        1,
        ...records.map(item => String(Math.abs(Math.round(Number(item?.count || 0)))).length)
      )
      if (maxDigits <= 2) return 24
      if (maxDigits === 3) return 22
      if (maxDigits === 4) return 20
      if (maxDigits === 5) return 18
      if (maxDigits === 6) return 16
      if (maxDigits === 7) return 14
      return 12
    },
    getSimulationTableCountStyle() {
      return {
        fontSize: `${this.getAdaptiveSimulationValueFontSize()}px`,
        lineHeight: 1.15
      }
    },
    getMiniSummaryTexts(group) {
      return {
        a: `A组：${Number(group.group_a_total ?? 0)}次`,
        b: `B组：${Number(group.group_b_total ?? 0)}次`,
        winner: this.winnerText(group.winner)
      }
    },
    getMiniSummaryText(group, key) {
      const groupMap = this.miniSummaryDisplayTextMap[group.group_id]
      if (groupMap && typeof groupMap[key] === 'string') {
        return groupMap[key]
      }
      const fullTextMap = this.getMiniSummaryTexts(group)
      return fullTextMap[key] || ''
    },
    clearMiniSummaryTypingTimers(groupId) {
      if (groupId) {
        this.stopTypingAudio()
      }
    },
    playTypingSoundEffect() {
      if (!this.typingAudio) return
      this.typingAudio.pause()
      this.typingAudio.currentTime = 0
      const playPromise = this.typingAudio.play()
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {})
      }
    },
    stopTypingAudio() {
      if (!this.typingAudio) return
      this.typingAudio.pause()
      this.typingAudio.currentTime = 0
    },
    startMiniSummaryTyping(groupId) {
      const group = this.groupsOverview.find(item => item.group_id === groupId)
      if (!group) return

      this.clearMiniSummaryTypingTimers(groupId)
      const textMap = this.getMiniSummaryTexts(group)
      this.miniSummaryDisplayTextMap = {
        ...this.miniSummaryDisplayTextMap,
        [groupId]: {
          a: textMap.a,
          b: textMap.b,
          winner: textMap.winner
        }
      }
      this.playTypingSoundEffect()
    },
    refreshVisibleMiniSummaryTexts() {
      const nextMap = { ...this.miniSummaryDisplayTextMap }
      this.groupsOverview.forEach(group => {
        if (!this.isMiniSummaryVisible(group.group_id)) return
        nextMap[group.group_id] = this.getMiniSummaryTexts(group)
      })
      this.miniSummaryDisplayTextMap = nextMap
    },
    syncMiniSummaryVisibility() {
      const nextVisibility = {}
      this.groupsOverview.forEach(group => {
        nextVisibility[group.group_id] = this.miniSummaryVisibleMap[group.group_id] === true
      })
      Object.keys(this.miniSummaryVisibleMap).forEach(key => {
        const groupId = Number(key)
        if (!nextVisibility[groupId]) {
          this.clearMiniSummaryTypingTimers(groupId)
          delete this.miniSummaryDisplayTextMap[groupId]
        }
      })
      this.miniSummaryVisibleMap = nextVisibility
    },
    isMiniSummaryVisible(groupId) {
      return this.miniSummaryVisibleMap[groupId] === true
    },
    toggleGroup(groupId, event) {
      if (event.target.checked) {
        if (!this.selectedGroupIds.includes(groupId)) this.selectedGroupIds = [...this.selectedGroupIds, groupId]
      } else {
        this.selectedGroupIds = this.selectedGroupIds.filter(id => id !== groupId)
      }
      this.$nextTick(() => this.renderClassChart())
    },
    normalizeGroupIds(groupIds) {
      if (!Array.isArray(groupIds) || !groupIds.length) return []
      const unique = new Set()
      groupIds.forEach(id => {
        const parsed = Number(id)
        if (Number.isInteger(parsed) && parsed > 0) {
          unique.add(parsed)
        }
      })
      return [...unique]
    },
    mergePendingOverviewGroupIds(groupIds = []) {
      const normalized = this.normalizeGroupIds(groupIds)
      if (!normalized.length) return
      const merged = new Set(this.pendingOverviewGroupIds)
      normalized.forEach(id => merged.add(id))
      this.pendingOverviewGroupIds = [...merged]
    },
    takePendingOverviewGroupIds() {
      const pending = [...this.pendingOverviewGroupIds]
      this.pendingOverviewGroupIds = []
      return pending
    },
    mergeGroupsOverview(updatedGroups = []) {
      if (!Array.isArray(updatedGroups) || !updatedGroups.length) return
      const mergedMap = new Map(this.groupsOverview.map(group => [group.group_id, group]))
      updatedGroups.forEach(group => {
        if (group && Number.isInteger(group.group_id)) {
          mergedMap.set(group.group_id, group)
        }
      })
      this.groupsOverview = Array.from(mergedMap.values()).sort((left, right) => left.group_id - right.group_id)
    },
    async fetchOverview(changedGroupIds = [], forceFull = false) {
      this.mergePendingOverviewGroupIds(changedGroupIds)
      if (forceFull) {
        this.hasPendingFullOverviewRefresh = true
      }
      if (this.isFetchingOverview) {
        this.hasPendingOverviewRefresh = true
        return
      }

      const groupIdsToRedraw = this.takePendingOverviewGroupIds()
      const shouldUseFullFetch =
        this.hasPendingFullOverviewRefresh ||
        !this.groupsOverview.length ||
        !groupIdsToRedraw.length

      this.isFetchingOverview = true
      try {
        this.error = ''
        if (shouldUseFullFetch) {
          const groupsRes = await axios.get('/api/teacher/groups-overview')
          this.groupsOverview = groupsRes.data
          this.hasPendingFullOverviewRefresh = false
        } else {
          const params = new URLSearchParams()
          groupIdsToRedraw.forEach(groupId => params.append('group_ids', String(groupId)))
          const deltaRes = await axios.get('/api/teacher/groups-overview-delta', {
            params
          })
          this.mergeGroupsOverview(deltaRes.data)
        }

        const validGroupIds = new Set(this.groupsOverview.map(group => group.group_id))
        this.selectedGroupIds = this.selectedGroupIds.filter(groupId => validGroupIds.has(groupId))
        this.syncMiniSummaryVisibility()
        this.refreshVisibleMiniSummaryTexts()

        this.$nextTick(() => {
          if (this.activeTab === 'groups') {
            this.renderMiniCharts()
          }
          if (this.activeTab === 'class') this.renderClassChart()
        })
      } catch (err) {
        this.error = '获取数据失败：' + (err.response?.data?.detail || err.message)
      } finally {
        this.isFetchingOverview = false
        if (this.hasPendingOverviewRefresh) {
          this.hasPendingOverviewRefresh = false
          this.scheduleFetchOverview()
        }
      }
    },
    scheduleFetchOverview(changedGroupIds = [], forceFull = false) {
      this.hasPendingOverviewRefresh = true
      this.mergePendingOverviewGroupIds(changedGroupIds)
      if (forceFull) {
        this.hasPendingFullOverviewRefresh = true
      }
      if (this.overviewRefreshTimer) return

      this.overviewRefreshTimer = setTimeout(async () => {
        this.overviewRefreshTimer = null
        if (!this.hasPendingOverviewRefresh) return
        this.hasPendingOverviewRefresh = false
        await this.fetchOverview()
      }, this.overviewRefreshDelay)
    },
    connectSocket() {
      if (this.socket) return

      this.socket = io('/', {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        reconnection: true
      })

      this.socket.on('connect', () => {
        this.error = ''
        this.scheduleFetchOverview([], true)
      })

      this.socket.on('connect_error', (err) => {
        this.error = '实时连接失败：' + err.message
      })

      this.socket.on('data_updated', (payload) => {
        this.scheduleFetchOverview(payload?.group_ids)
      })
    },
    renderMiniCharts() {
      const sharedMax = Math.max(8, ...this.groupsOverview.flatMap(group => (group.records || []).map(record => Number(record.count || 0))))
      this.groupsOverview.forEach(group => {
        const el = this.miniChartEls[group.group_id]
        if (!el) return
        if (!this.miniCharts[group.group_id]) this.miniCharts[group.group_id] = markRaw(echarts.init(el))
        this.miniCharts[group.group_id].setOption(buildMiniChartOption({
          numbers: group.records.map(item => item.number),
          counts: group.records.map(item => item.count),
          axisMax: sharedMax
        }))
      })
    },
    renderClassChart() {
      if (!this.$refs.classChartRef) return
      if (!this.classChart) this.classChart = markRaw(echarts.init(this.$refs.classChartRef))
      const summary = this.classSummary
      const numbers = summary.records.map(item => item.number)
      const counts = summary.records.map(item => item.count)
      const maxCount = counts.length ? Math.max(...counts) : 0
      const axisMax = Math.max(30, Math.ceil(maxCount))
      this.classChart.setOption(buildClassChartOption({
        numbers,
        counts,
        alignedAxisMax: axisMax,
        axisInterval: this.getAxisInterval(axisMax)
      }))
    },
    async updateComparisonData() {
      if (this.isUpdatingComparison) return
      this.isUpdatingComparison = true
      try {
        const response = await axios.get('/api/teacher/groups-overview')
        const groups = response.data.map(group => JSON.parse(JSON.stringify(group)))
        this.comparisonData = {
          groups,
          classSummary: this.summarizeGroups(groups),
          simulations: this.comparisonData.simulations
        }
        await this.$nextTick()
        this.renderComparisonCharts()
      } catch (err) {
        this.error = '更新对比数据失败：' + (err.response?.data?.detail || err.message)
      } finally {
        this.isUpdatingComparison = false
      }
    },
    saveSimulationToSlot(index) {
      if (!this.pendingComparisonSimulation) return
      const simulations = [...this.comparisonData.simulations]
      simulations[index] = JSON.parse(JSON.stringify(this.pendingComparisonSimulation))
      this.comparisonData = { ...this.comparisonData, simulations }
      this.pendingComparisonSimulation = null
      if (this.activeTab === 'comparison') this.$nextTick(() => this.renderComparisonCharts())
    },
    saveSimulationForComparison(result) {
      const emptyIndex = this.comparisonData.simulations.findIndex(run => !run)
      if (emptyIndex >= 0) {
        const simulations = [...this.comparisonData.simulations]
        simulations[emptyIndex] = JSON.parse(JSON.stringify(result))
        this.comparisonData = { ...this.comparisonData, simulations }
      } else {
        this.pendingComparisonSimulation = JSON.parse(JSON.stringify(result))
      }
    },
    renderComparisonCharts() {
      const groups = this.comparisonData.groups
      const sharedMax = Math.max(8, ...groups.flatMap(group => (group.records || []).map(record => Number(record.count || 0))))
      groups.forEach(group => {
        const el = this.comparisonMiniChartEls[group.group_id]
        if (!el) return
        if (!this.comparisonMiniCharts[group.group_id]) this.comparisonMiniCharts[group.group_id] = markRaw(echarts.init(el))
        this.comparisonMiniCharts[group.group_id].setOption(buildMiniChartOption({
          numbers: group.records.map(item => item.number),
          counts: group.records.map(item => item.count),
          axisMax: sharedMax
        }))
      })
      const classEl = this.$refs.comparisonClassChartRef
      if (classEl && this.comparisonData.classSummary) {
        if (!this.comparisonClassChart) this.comparisonClassChart = markRaw(echarts.init(classEl))
        const summary = this.comparisonData.classSummary
        const maxCount = Math.max(0, ...summary.records.map(item => item.count))
        const axisMax = Math.max(30, Math.ceil(maxCount))
        this.comparisonClassChart.setOption(buildClassChartOption({
          numbers: summary.records.map(item => item.number),
          counts: summary.records.map(item => item.count),
          alignedAxisMax: axisMax,
          axisInterval: this.getAxisInterval(axisMax)
        }))
      }
      this.comparisonData.simulations.forEach((run, index) => {
        const el = this.comparisonSimulationChartEls[index]
        if (!run || !el) return
        if (!this.comparisonSimulationCharts[index]) this.comparisonSimulationCharts[index] = markRaw(echarts.init(el))
        const counts = run.records.map(record => Number(record.count || 0))
        const axisMax = Math.max(10, ...counts)
        this.comparisonSimulationCharts[index].setOption(buildSimulationChartOption({
          numbers: run.records.map(record => record.number),
          counts,
          axisMax,
          axisInterval: this.getAxisInterval(axisMax),
          simLabelFontSize: this.getAdaptiveSimulationValueFontSize(run.records)
        }))
      })
    },
    async runSimulation() {
      const targetTimes = Number(this.simulationInput)
      if (!Number.isInteger(targetTimes) || targetTimes < 1) {
        this.error = '请输入大于 0 的整数次数'
        this.stopDiceSimulation()
        return
      }
      this.simulating = true
      try {
        const res = await axios.post('/api/teacher/simulate', null, {
          params: { total_times: targetTimes }
        })
        this.simulationData = res.data
        this.saveSimulationForComparison(res.data)
        if (this.simulationTimer) {
          clearInterval(this.simulationTimer)
          this.simulationTimer = null
        }

        this.simAnimatedRecords = this.simulationData.records.map(item => ({
          number: item.number,
          count: 0
        }))
        const finalMaxCount = this.simulationData.records.length
          ? Math.max(...this.simulationData.records.map(item => Number(item.count || 0)))
          : 0
        this.simAnimationAxisStartMax = 10
        this.simAnimationAxisMax = this.getAxisMaxWithHeadroom(finalMaxCount, 10)
        this.simAnimationLabelFontSize = this.getAdaptiveSimulationValueFontSize(this.simulationData.records)

        this.$nextTick(() => {
          try {
            this.renderSimulationChart(
              this.simAnimatedRecords,
              this.simAnimationAxisMax,
              this.simAnimationLabelFontSize
            )
            this.animateSimulationRecords()
          } catch (error) {
            this.simulating = false
            this.error = '渲染图表失败：' + (error?.message || '未知错误')
            this.stopDiceSimulation()
          }
        })
      } catch (err) {
        this.error = '模拟请求失败：' + (err.response?.data?.detail || err.message)
        if (this.simulationTimer) {
          clearInterval(this.simulationTimer)
          this.simulationTimer = null
        }
        this.simAnimationAxisStartMax = null
        this.simAnimationAxisMax = null
        this.simAnimationLabelFontSize = null
        this.simulating = false
        this.stopDiceSimulation()
      }
    },
    animateSimulationRecords() {
      const finalRecords = this.simulationData.records
      if (!finalRecords.length) {
        this.simulating = false
        this.stopDiceSimulation()
        return
      }

      const duration = Number(this.plannedSimulationDurationMs) || this.getSimulationDurationMs()
      const startTime = Date.now()

      this.simulationTimer = setInterval(() => {
        try {
          const elapsed = Date.now() - startTime
          const progress = Math.min(1, elapsed / duration)
          const finalMaxCount = finalRecords.length
            ? Math.max(...finalRecords.map(item => Number(item.count || 0)))
            : 0
          // Keep axis changing, but slower than bar growth:
          // start from a higher baseline and move to final range.
          const axisSource = finalMaxCount * (0.45 + 0.55 * progress)
          const currentAxisMax = this.getAxisMaxWithHeadroom(axisSource, 10)

          this.simAnimatedRecords = finalRecords.map(item => ({
            number: item.number,
            count: Math.round(item.count * progress)
          }))

          const animatedChartRecords = finalRecords.map(item => ({
            number: item.number,
            count: item.count * progress
          }))
          this.renderSimulationChart(animatedChartRecords, currentAxisMax, this.simAnimationLabelFontSize)

          if (progress >= 1) {
            clearInterval(this.simulationTimer)
            this.simulationTimer = null
            this.simAnimatedRecords = finalRecords.map(item => ({ ...item }))
            this.renderSimulationChart(
              this.simulationData.records,
              this.simAnimationAxisMax,
              this.simAnimationLabelFontSize
            )
            this.simAnimationAxisStartMax = null
            this.simAnimationAxisMax = null
            this.simAnimationLabelFontSize = null
            this.simulating = false
            this.stopDiceSimulation(false)
          }

        } catch (error) {
          clearInterval(this.simulationTimer)
          this.simulationTimer = null
          this.simAnimationAxisStartMax = null
          this.simAnimationAxisMax = null
          this.simAnimationLabelFontSize = null
          this.simulating = false
          this.error = '动画渲染失败：' + (error?.message || '未知错误')
          this.stopDiceSimulation()
        }
      }, 16)
    },
    renderSimulationChart(records = this.simulationData.records, fixedAxisMax = null, fixedLabelFontSize = null) {
      if (!this.$refs.simChartRef) return
      if (!this.simChart) this.simChart = markRaw(echarts.init(this.$refs.simChartRef))

      const numbers = records.map(i => i.number)
      const counts = records.map(i => i.count)
      const maxCount = counts.length ? Math.max(...counts) : 0
      const axisMax = Math.ceil(fixedAxisMax || this.getAxisMaxWithHeadroom(maxCount, 10))
      const axisInterval = this.getAxisInterval(axisMax)
      const simLabelFontSize = Number(fixedLabelFontSize || this.getAdaptiveSimulationValueFontSize(records))
      this.simChart.setOption(
        buildSimulationChartOption({
          numbers,
          counts,
          axisMax,
          axisInterval,
          simLabelFontSize
        })
      )
    },
    onResize() {
      if (this.chartResizeFrame) cancelAnimationFrame(this.chartResizeFrame)
      this.chartResizeFrame = requestAnimationFrame(() => {
        this.chartResizeFrame = null
        const charts = [
          this.classChart, this.simChart, this.comparisonClassChart,
          ...Object.values(this.miniCharts),
          ...Object.values(this.comparisonMiniCharts),
          ...Object.values(this.comparisonSimulationCharts)
        ]
        charts.forEach(chart => {
          if (!chart || chart.isDisposed()) return
          const element = chart.getDom()
          // Hidden tabs have no measurable size; resize them when shown instead.
          if (element.clientWidth && element.clientHeight) chart.resize()
        })
      })
    },
    observeChartContainers() {
      if (!this.chartResizeObserver) return
      this.$el.querySelectorAll('.mini-chart, .class-chart, .sim-chart, .comparison-sim-chart').forEach(element => {
        if (this.observedChartElements.has(element)) return
        this.observedChartElements.add(element)
        this.chartResizeObserver.observe(element)
      })
    }
  },
  updated() {
    this.observeChartContainers()
  },
  async mounted() {
    this.observedChartElements = new WeakSet()
    this.chartResizeObserver = new ResizeObserver(this.onResize)
    this.observeChartContainers()
    window.addEventListener('resize', this.onResize)
    document.addEventListener('fullscreenchange', this.onResize)
    this.typingAudio = new Audio(daziAudioSrc)
    this.typingAudio.loop = false
    this.typingAudio.preload = 'auto'
    this.typingAudio.volume = 0.50
    this.typingAudio.playbackRate = 1.1

    await this.fetchOverview([], true)
    this.$nextTick(() => {
      const videoEl = this.$refs.diceVideoRef
      if (videoEl) {
        videoEl.preload = 'auto'
        videoEl.load()
        this.ensureDiceFirstFrame(videoEl)
      }
    })
    this.connectSocket()

  },
  beforeUnmount() {
    this.chartResizeObserver?.disconnect()
    if (this.chartResizeFrame) cancelAnimationFrame(this.chartResizeFrame)
    document.removeEventListener('fullscreenchange', this.onResize)
    if (this.simulationTimer) clearInterval(this.simulationTimer)
    this.simAnimationAxisStartMax = null
    this.simAnimationAxisMax = null
    this.simAnimationLabelFontSize = null
    if (this.overviewRefreshTimer) clearTimeout(this.overviewRefreshTimer)
    if (this.socket) this.socket.disconnect()
    window.removeEventListener('resize', this.onResize)
    if (this.classChart) this.classChart.dispose()
    if (this.simChart) this.simChart.dispose()
    Object.values(this.miniCharts).forEach(chart => chart.dispose())
    Object.values(this.comparisonMiniCharts).forEach(chart => chart.dispose())
    Object.values(this.comparisonSimulationCharts).forEach(chart => chart.dispose())
    if (this.comparisonClassChart) this.comparisonClassChart.dispose()
    this.stopTypingAudio()
    this.typingAudio = null
    this.stopDiceSimulation()
  }
}
</script>

<style scoped src="./teacher-layout.css"></style>
