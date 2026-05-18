<template>
  <section class="teacher-page">
    <header class="teacher-head">

    </header>

    <article class="panel-card">
      <div class="section-head class-section-head">
        <h3>小组试验结果统计图</h3>
      </div>
      <div class="group-grid">
        <div v-for="group in groupsOverview" :key="group.group_id" class="mini-card">
          <div class="mini-head">
            <span class="mini-title">{{ group.group_name }}</span>
          </div>
          <div class="mini-chart" :ref="setMiniChartRef(group.group_id)"></div>
          <div class="mini-summary-row">
            <div class="mini-summary-chip mini-a-chip">{{ getMiniSummaryText(group, 'a') }}</div>
            <div class="mini-summary-chip mini-b-chip">{{ getMiniSummaryText(group, 'b') }}</div>
            <div
              class="mini-summary-chip mini-winner-chip"
              :class="[
                miniWinnerClass(group.winner),
                { 'mini-summary-chip-empty': !getMiniSummaryText(group, 'winner') }
              ]"
            >
              {{ getMiniSummaryText(group, 'winner') }}
            </div>
          </div>
        </div>
      </div>
    </article>

    <article class="panel-card">
      <div class="section-head class-section-head">
        <h3>全班试验结果统计图</h3>
      </div>
      <div class="class-overview-row">
        <div ref="classChartRef" class="class-chart" :style="{ height: `${classChartHeight}px` }"></div>
        <div class="class-group-list-panel">
          <div
            v-for="group in groupsOverview"
            :key="`class-group-${group.group_id}`"
            class="class-group-list-item"
          >
            <input
              type="checkbox"
              :checked="selectedGroupIds.includes(group.group_id)"
              @change="toggleGroup(group.group_id, $event)"
            />
            <span class="class-group-list-text">{{ group.group_name }}</span>
          </div>
        </div>
      </div>
      <div class="class-stats-row">
        <article class="class-stat-card class-a-card">
          <span class="class-stat-icon">●</span>
          <p class="class-stat-line">掷到A组：{{ Number(filteredClassSummary.group_a_total ?? 0) }}次</p>
        </article>

        <article class="class-stat-card class-b-card">
          <span class="class-stat-icon">●</span>
          <p class="class-stat-line">掷到B组：{{ Number(filteredClassSummary.group_b_total ?? 0) }}次</p>
        </article>

        <article class="class-stat-card class-winner-card" :class="classWinnerCardClass(filteredClassSummary.winner)">
          <span class="class-stat-icon class-flag">🚩</span>
          <p class="class-stat-line">{{ winnerText(filteredClassSummary.winner) }}</p>
        </article>
      </div>
    </article>

    <article class="panel-card">
      <div class="section-head sim-section-head">
        <h3>大数据试验统计</h3>
      </div>
      <div class="sim-controls">
        <input
          v-model="simulationInput"
          type="number"
          min="0"
          class="sim-input"
          placeholder="请输入模拟次数"
        />
        <button @click="runSimulationAndDice" :disabled="simulating || isDiceRolling" class="sim-btn">
          {{ (simulating || isDiceRolling) ? '模拟中...' : '开始模拟' }}
        </button>
      </div>

      <div class="sim-table-wrap" v-if="simulationDisplayRecords.length">
        <table class="sim-table">
          <tbody>
            <tr>
              <th>点数和</th>
              <td v-for="item in simulationDisplayRecords" :key="`num-${item.number}`">{{ item.number }}</td>
            </tr>
            <tr>
              <th>次数</th>
              <td
                v-for="item in simulationDisplayRecords"
                :key="`cnt-${item.number}`"
                :class="[2, 3, 4, 10, 11, 12].includes(item.number) ? 'sim-count-a' : 'sim-count-b'"
                :style="getSimulationTableCountStyle()"
              >
                {{ item.count }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="sim-visual-row">
        <div ref="simChartRef" class="sim-chart" :style="{ height: `${simChartHeight}px` }"></div>
        <div class="dice-panel">
          <div class="dice-2d-wrap">
            <video
              ref="diceVideoRef"
              class="dice-video"
              :src="diceVideoSrc"
              :poster="dicePosterDataUrl"
              @error="onDiceVideoError"
              @loadedmetadata="onDiceVideoLoadedMetadata"
              playsinline
              webkit-playsinline="true"
              x5-playsinline="true"
              x5-video-player-type="h5"
              preload="auto"
            ></video>
            <div v-if="diceVideoLoadFailed" class="dice-video-fallback">视频加载失败</div>
          </div>
        </div>
      </div>

      <div class="class-stats-row" v-if="simulationData.records.length">
        <article class="class-stat-card class-a-card">
          <span class="class-stat-icon">●</span>
          <p class="class-stat-line">掷到A组：{{ Number(simulationDisplayGroupATotal ?? 0) }}次</p>
        </article>

        <article class="class-stat-card class-b-card">
          <span class="class-stat-icon">●</span>
          <p class="class-stat-line">掷到B组：{{ Number(simulationDisplayGroupBTotal ?? 0) }}次</p>
        </article>

        <article class="class-stat-card class-winner-card" :class="classWinnerCardClass(simulationData.winner)">
          <span class="class-stat-icon class-flag">🚩</span>
          <p class="class-stat-line">{{ winnerText(simulationData.winner) }}</p>
        </article>
      </div>
    </article>

    <p v-if="error" class="error-text">{{ error }}</p>
  </section>
</template>

<script>
import axios from '../lib/http'
import * as echarts from 'echarts'
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
      groupsOverview: [],
      classSummary: {
        records: [],
        group_a_total: 0,
        group_b_total: 0,
        winner: 'Tie'
      },
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
      classChartHeight: 360,
      simChartHeight: 360,
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
    allGroupIds() {
      return this.groupsOverview.map(group => group.group_id)
    },
    filteredClassSummary() {
      const selected = this.groupsOverview.filter(group => this.selectedGroupIds.includes(group.group_id))

      if (!selected.length) {
        return {
          records: Array.from({ length: 11 }, (_, idx) => ({ number: idx + 2, count: 0 })),
          group_a_total: 0,
          group_b_total: 0,
          winner: 'Tie'
        }
      }

      const totals = { 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0 }
      selected.forEach(group => {
        group.records.forEach(record => {
          if (typeof totals[record.number] === 'number') {
            totals[record.number] += record.count
          }
        })
      })

      const records = Object.keys(totals).map(number => ({
        number: Number(number),
        count: totals[number]
      }))

      const groupATotal = records
        .filter(record => GROUP_A_NUMBERS.includes(record.number))
        .reduce((sum, record) => sum + record.count, 0)
      const groupBTotal = records
        .filter(record => GROUP_B_NUMBERS.includes(record.number))
        .reduce((sum, record) => sum + record.count, 0)

      let winner = 'Tie'
      if (groupATotal > groupBTotal) winner = 'A'
      else if (groupBTotal > groupATotal) winner = 'B'

      return {
        records,
        group_a_total: groupATotal,
        group_b_total: groupBTotal,
        winner
      }
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
    getAdaptiveChartHeight(maxValue, baseHeight = 360) {
      if (maxValue <= 30) return Math.max(baseHeight, 320)
      if (maxValue <= 80) return Math.max(baseHeight, 360)
      if (maxValue <= 150) return Math.max(baseHeight, 400)
      return Math.max(baseHeight, 440)
    },
    getAdaptiveSimChartHeight(maxValue, baseHeight = 360) {
      if (maxValue <= 30) return Math.max(baseHeight, 220)
      if (maxValue <= 80) return Math.max(baseHeight, 260)
      if (maxValue <= 150) return Math.max(baseHeight, 300)
      return Math.max(baseHeight, 340)
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
      const checked = event.target.checked
      if (checked) {
        if (!this.selectedGroupIds.includes(groupId)) {
          this.selectedGroupIds.push(groupId)
        }
      } else {
        this.selectedGroupIds = this.selectedGroupIds.filter(id => id !== groupId)
      }
      this.$nextTick(() => {
        this.renderClassChart()
      })
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

        const currentGroupIds = this.groupsOverview.map(group => group.group_id)
        this.selectedGroupIds = this.selectedGroupIds.filter(id => currentGroupIds.includes(id))
        this.syncMiniSummaryVisibility()
        this.refreshVisibleMiniSummaryTexts()

        this.$nextTick(() => {
          this.renderMiniCharts(shouldUseFullFetch ? [] : groupIdsToRedraw)
          this.renderClassChart()
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
    renderMiniCharts(changedGroupIds = []) {
      const normalizedIds = this.normalizeGroupIds(changedGroupIds)
      const hasTargetGroups = normalizedIds.length > 0
      const targetGroupIdSet = new Set(normalizedIds)
      this.groupsOverview.forEach(group => {
        if (hasTargetGroups && !targetGroupIdSet.has(group.group_id)) return
        const el = this.miniChartEls[group.group_id]
        if (!el) return

        if (!this.miniCharts[group.group_id]) {
          this.miniCharts[group.group_id] = echarts.init(el)
        }

        const numbers = group.records.map(i => i.number)
        const counts = group.records.map(i => i.count)
        const maxCount = counts.length ? Math.max(...counts) : 0
        const axisMax = Math.max(8, maxCount)

        this.miniCharts[group.group_id].setOption(buildMiniChartOption({ numbers, counts, axisMax }))
      })
    },
    renderClassChart() {
      if (!this.$refs.classChartRef) return
      if (!this.classChart) this.classChart = echarts.init(this.$refs.classChartRef)

      const numbers = this.filteredClassSummary.records.map(i => i.number)
      const counts = this.filteredClassSummary.records.map(i => i.count)
      const maxCount = counts.length ? Math.max(...counts) : 0
      const axisMax = Math.max(30, Math.ceil(maxCount))
      const axisInterval = this.getAxisInterval(axisMax)
      const alignedAxisMax = Math.ceil(axisMax)
      this.classChartHeight = this.getAdaptiveChartHeight(maxCount, 360)

      this.classChart.setOption(
        buildClassChartOption({ numbers, counts, alignedAxisMax, axisInterval })
      )
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
      if (!this.simChart) this.simChart = echarts.init(this.$refs.simChartRef)

      const numbers = records.map(i => i.number)
      const counts = records.map(i => i.count)
      const maxCount = counts.length ? Math.max(...counts) : 0
      const axisMax = Math.ceil(fixedAxisMax || this.getAxisMaxWithHeadroom(maxCount, 10))
      const axisInterval = this.getAxisInterval(axisMax)
      const simLabelFontSize = Number(fixedLabelFontSize || this.getAdaptiveSimulationValueFontSize(records))
      const chartHeightBasis = fixedAxisMax || maxCount
      this.simChartHeight = this.getAdaptiveSimChartHeight(chartHeightBasis, 360)

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
      if (this.classChart) this.classChart.resize()
      if (this.simChart) this.simChart.resize()
      Object.values(this.miniCharts).forEach(chart => chart.resize())
    }
  },
  async mounted() {
    this.typingAudio = new Audio(daziAudioSrc)
    this.typingAudio.loop = false
    this.typingAudio.preload = 'auto'
    this.typingAudio.volume = 0.50
    this.typingAudio.playbackRate = 1.1

    await this.fetchOverview([], true)
    this.$nextTick(() => {
      this.renderSimulationChart(this.simulationData.records)
      const videoEl = this.$refs.diceVideoRef
      if (videoEl) {
        videoEl.preload = 'auto'
        videoEl.load()
        this.ensureDiceFirstFrame(videoEl)
      }
    })
    this.connectSocket()

    window.addEventListener('resize', this.onResize)
  },
  beforeUnmount() {
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
    this.stopTypingAudio()
    this.typingAudio = null
    this.stopDiceSimulation()
  }
}
</script>

<style scoped>
.teacher-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.teacher-head h2 {
  margin: 0;
  font-size: 40px;
  color: #0f172a;
  text-align: center;
}

.teacher-head p {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 14px;
  text-align: center;
}

.panel-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.06);
  padding: 16px;
}

.section-head {
  margin-bottom: 12px;
  text-align: center;
}

.section-head h3 {
  margin: 0;
  font-size: 18px;
  color: #0f172a;
}

.class-section-head h3,
.sim-section-head h3 {
  font-size: 40px;
}

.group-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.mini-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 10px;
  background: #ffffff;
}

.mini-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.mini-title {
  font-size: 26px;
  font-weight: 700;
  color: #000080;
}

.mini-badge {
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 700;
}

.a-badge {
  background: #fef9c3;
  color: #a16207;
}

.b-badge {
  background: #fee2e2;
  color: #b91c1c;
}

.tie-badge {
  background: #e2e8f0;
  color: #334155;
}

.mini-chart {
  height: 180px;
}

.mini-summary-toggle-row {
  margin-top: 6px;
  display: flex;
  justify-content: center;
}

.mini-summary-toggle-btn {
  border: 1px solid #3b82f6;
  border-radius: 10px;
  background: transparent;
  color: #3b82f6;
  font-size: 12px;
  font-weight: 700;
  padding: 6px 10px;
  cursor: pointer;
}

.mini-summary-toggle-btn-active {
  background: #3b82f6;
  color: #ffffff;
}

.mini-summary-row {
  margin-top: 2px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
}

.mini-summary-chip {
  border-radius: 999px;
  padding: 2px 6px;
  font-size: 22px;
  font-weight: 700;
  text-align: center;
}

.mini-summary-chip-empty {
  padding: 0;
  background: transparent !important;
}

.mini-count-value {
  font-size: 1em;
  font-weight: 800;
}

.mini-a-chip {
  background: #ffffff;
  color: #0f172a;
}

.mini-b-chip {
  background: #ffffff;
  color: #0f172a;
}

.mini-winner-chip {
  font-size: 25px;
  flex: 0 0 auto;
  width: fit-content;
  padding-left: 10;
  padding-right: 10;
  white-space: nowrap;
  margin: 0 auto;
}

.mini-a-win-chip {
  background: #FFE600;
  color: #1f2937;
}

.mini-b-win-chip {
  background: #D92121;
  color: #ffffff;
}

.mini-tie-win-chip {
  background: #e2e8f0;
  color: #334155;
}

.class-chart {
  flex: 1 1 auto;
  width: auto;
  min-height: 320px;
  min-width: 0;
}

.class-overview-row {
  display: flex;
  align-items: flex-start;
  gap: 0px;
}

.class-group-list-panel {
  flex: 0 0 108px;
  max-height: 360px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  overflow-y: auto;
}

.class-group-list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 26px;
  font-weight: 700;
  color: #000080;
  line-height: 1.1;
}

.class-group-list-item input {
  margin: 0;
  width: 22px;
  height: 22px;
  accent-color: #3b82f6;
}

.class-group-list-text {
  font-size: inherit;
  font-weight: inherit;
  color: inherit;
}

.class-stats-row {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.class-stat-card {
  border-radius: 12px;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid #e2e8f0;
  white-space: nowrap;
}

.class-stat-icon {
  font-size: 18px;
}

.class-stat-line {
  margin: 0;
  font-size: 18px;
  line-height: 1.1;
  font-weight: 800;
}

.class-stat-label {
  margin: 0;
  font-size: 16px;
  line-height: 1.1;
  font-weight: 800;
  color: #334155;
}

.class-stat-value {
  margin: 4px 0 0;
  font-size: 18px;
  line-height: 1.1;
  font-weight: 800;
}

.class-a-card {
  background: #fef9c3;
}

.class-a-card .class-stat-icon,
.class-a-card .class-stat-label,
.class-a-card .class-stat-value,
.class-a-card .class-stat-line {
  color: #a16207;
}

.class-b-card {
  background: #fee2e2;
}

.class-b-card .class-stat-icon,
.class-b-card .class-stat-label,
.class-b-card .class-stat-value,
.class-b-card .class-stat-line {
  color: #b91c1c;
}

.class-winner-card {
  background: #ffffff;
}

.class-winner-card .class-stat-line {
  font-size: 50px;
  line-height: 1;
}

.class-flag {
  font-size: 27px;
}

.class-winner-a-card {
  background: #ffffff;
}

.class-winner-a-card .class-stat-label,
.class-winner-a-card .class-stat-icon {
  color: #64748b;
}

.class-winner-a-card .class-stat-line {
  color: #FFE600;
}

.class-winner-b-card {
  background: #ffffff;
}

.class-winner-b-card .class-stat-label,
.class-winner-b-card .class-stat-icon {
  color: #64748b;
}

.class-winner-b-card .class-stat-line {
  color: #D92121;
}

.class-winner-tie-card {
  background: #ffffff;
}

.class-winner-badge {
  margin-top: 6px;
  display: inline-block;
  border-radius: 999px;
  padding: 5px 8px;
  font-size: 11px;
  font-weight: 700;
  text-align: center;
  background: rgba(255, 255, 255, 0.35);
}

.sim-chart {
  flex: 1.7;
  min-width: 0;
  min-height: 220px;
}

.sim-visual-row {
  display: flex;
  align-items: stretch;
  gap: 12px;
}

.dice-panel {
  flex: 0.45
  ;
  align-self: flex-start;
  min-width: 0px;
  border: none;
  border-radius: 0;
  background: transparent;
  padding: 0;
}

.dice-2d-wrap {
  height: 300px;
  display: flex;
  position: relative;
  align-items: center;
  justify-content: center;
  width: 100%;
  overflow: hidden;
  border-radius: 12px;
}

.dice-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.dice-video-fallback {
  position: absolute;
  color: #334155;
  font-size: 14px;
  font-weight: 700;
}

.dice-face {
  width: 102px;
  height: 102px;
  border-radius: 16px;
  border: 2px solid #cbd5e1;
  background: #ffffff;
  position: relative;
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.12);
  transition: transform 0.16s ease;
}

.dice-face.rolling {
  animation: dice-shake 0.34s cubic-bezier(0.22, 1, 0.36, 1) infinite;
}

.dice-face.rolling:nth-child(2) {
  animation-duration: 0.38s;
}

.pip {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #0f172a;
}

.dice-face-red .pip {
  background: #D92121;
}

.top-left { top: 17px; left: 17px; }
.top-right { top: 17px; right: 17px; }
.middle-left { top: 45px; left: 17px; }
.middle-right { top: 45px; right: 17px; }
.bottom-left { bottom: 17px; left: 17px; }
.bottom-right { bottom: 17px; right: 17px; }
.center { top: 45px; left: 45px; }

@keyframes dice-shake {
  0% { transform: translateY(0px) rotate(0deg) scale(1); }
  20% { transform: translateY(-7px) rotate(-9deg) scale(1.02); }
  45% { transform: translateY(5px) rotate(8deg) scale(0.99); }
  70% { transform: translateY(-3px) rotate(-5deg) scale(1.01); }
  100% { transform: translateY(0px) rotate(0deg) scale(1); }
}

.sim-table-wrap {
  margin-bottom: 12px;
  overflow-x: auto;
}

.sim-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  border: 1px solid #cbd5e1;
}

.sim-table th,
.sim-table td {
  border: 1px solid #cbd5e1;
  text-align: center;
  padding: 6px 4px;
  font-size: 12px;
  color: #334155;
}

.sim-table tbody tr:first-child td {
  font-size: 24px;
}

.sim-table tbody tr:nth-child(2) td {
  font-size: 24px;
}

.sim-table td.sim-count-a {
  color: #FFB300 ;
}

.sim-table td.sim-count-b {
  color: #D92121;
}

.sim-table th {
  width: 56px;
  background: #f8fafc;
  font-weight: 700;
}

.group-filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-bottom: 10px;
}

.group-filter-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 999px;
  background: #f8fafc;
  font-size: 24px;
  color: #334155;
  user-select: none;
}

.group-filter-item input {
  margin: 0;
}

.all-item {
  background: #eef2ff;
  border-color: #c7d2fe;
  font-weight: 700;
}

.sim-controls {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}

.sim-input {
  flex: 1;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  padding: 10px 12px;
  outline: none;
}

.sim-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18);
}

.sim-btn {
  border: none;
  border-radius: 12px;
  background: #3b82f6;
  color: #fff;
  padding: 10px 14px;
  font-weight: 700;
  cursor: pointer;
}

.sim-btn:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}

.summary-row {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.summary-chip {
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 700;
  background: #f1f5f9;
  color: #334155;
  text-align: center;
}

.a-chip {
  background: #fffbeb;
  color: #92400e;
}

.b-chip {
  background: #eff6ff;
  color: #1e40af;
}

.error-text {
  margin: 0;
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 13px;
}

@media (max-width: 980px) {
  .group-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .class-overview-row {
    flex-direction: column;
  }

  .class-group-list-panel {
    flex: 0 0 auto;
    width: 100%;
    height: 280px;
  }

  .sim-visual-row {
    flex-direction: column;
  }

  .dice-panel {
    min-width: 0;
  }
}

@media (max-width: 640px) {
  .group-grid {
    grid-template-columns: 1fr;
  }

  .class-stats-row {
    grid-template-columns: 1fr;
  }

  .sim-controls {
    flex-direction: column;
  }
}

</style>






