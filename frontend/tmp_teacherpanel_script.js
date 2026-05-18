import axios from '../lib/http'
import * as echarts from 'echarts'
import { io } from 'socket.io-client'

const yaotouziBundledVideoSrc = new URL('../assets/yaotouzi.mp4', import.meta.url).href
const daziAudioSrc = new URL('../assets/dazi.mp3', import.meta.url).href
const yaotouziVideoSrcCandidates = [
  yaotouziBundledVideoSrc,
  `${import.meta.env.BASE_URL}yaotouzi.mp4`,
  '/yaotouzi.mp4',
  './yaotouzi.mp4'
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
  name: 'TeacherPanel',
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
      classPieChart: null,
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
    isAllSelected() {
      if (!this.allGroupIds.length) return false
      return this.allGroupIds.every(id => this.selectedGroupIds.includes(id))
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
        .filter(record => [2, 3, 4, 10, 11, 12].includes(record.number))
        .reduce((sum, record) => sum + record.count, 0)
      const groupBTotal = records
        .filter(record => [5, 6, 7, 8, 9].includes(record.number))
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
        .filter(record => [2, 3, 4, 10, 11, 12].includes(record.number))
        .reduce((sum, record) => sum + record.count, 0)
    },
    simulationDisplayGroupBTotal() {
      return this.simulationDisplayRecords
        .filter(record => [5, 6, 7, 8, 9].includes(record.number))
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
        this.error = '????? 0 ?????'
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
    badgeClass(winner) {
      if (winner === 'A') return 'a-badge'
      if (winner === 'B') return 'b-badge'
      return 'tie-badge'
    },
    winnerText(winner) {
      if (winner === 'A') return 'A???'
      if (winner === 'B') return 'B???'
      return '??'
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
    getGroupTotalCount(group) {
      if (!Array.isArray(group?.records)) return 0
      return group.records.reduce((sum, record) => sum + Number(record.count || 0), 0)
    },
    getClassPieColors() {
      if (this.isAllSelected) {
        return this.groupsOverview.map(() => '#00FF00')
      }

      return this.groupsOverview.map((group) => {
        if (this.selectedGroupIds.includes(group.group_id)) {
          return '#00FF00'
        }
        return '#cbd5e1'
      })
    },
    renderClassPieChart() {
      if (!this.$refs.classPieChartRef) return
      if (!this.classPieChart) {
        this.classPieChart = echarts.init(this.$refs.classPieChartRef)
        this.classPieChart.on('click', (params) => {
          const groupId = Number(params?.data?.groupId)
          if (!Number.isInteger(groupId)) return

          if (this.selectedGroupIds.includes(groupId)) {
            this.selectedGroupIds = this.selectedGroupIds.filter(id => id !== groupId)
          } else {
            this.selectedGroupIds = [...this.selectedGroupIds, groupId]
          }

          this.$nextTick(() => {
            this.renderClassChart()
            this.renderClassPieChart()
          })
        })
      }

      const colors = this.getClassPieColors()
      const pieData = this.groupsOverview.map((group, idx) => ({
        value: this.getGroupTotalCount(group),
        name: group.group_name,
        groupId: group.group_id,
        itemStyle: { color: colors[idx] }
      }))

      this.classPieChart.setOption({
        tooltip: { trigger: 'item' },
        series: [
          {
            type: 'pie',
            radius: '55%',
            center: ['50%', '50%'],
            avoidLabelOverlap: false,
            label: {
              formatter: (params) => params?.data?.name || '',
              fontSize: 26,
              fontWeight: 700,
              color: '#000080',
              overflow: 'none'
            },
            labelLine: { length: 8, length2: 8, smooth: false },
            data: pieData
          }
        ]
      })
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
    isMiniSummaryReady(group) {
      const groupATotal = Number(group?.group_a_total ?? 0)
      const groupBTotal = Number(group?.group_b_total ?? 0)
      return groupATotal + groupBTotal >= 40
    },
    toggleAllGroups(event) {
      const checked = event.target.checked
      this.selectedGroupIds = checked ? [...this.allGroupIds] : []
      this.$nextTick(() => {
        this.renderClassChart()
      })
    },
    getMiniSummaryTexts(group) {
      return {
        a: `A??${Number(group.group_a_total ?? 0)}?`,
        b: `B??${Number(group.group_b_total ?? 0)}?`,
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
    toggleMiniSummary(groupId) {
      const willShow = !this.isMiniSummaryVisible(groupId)
      this.miniSummaryVisibleMap = {
        ...this.miniSummaryVisibleMap,
        [groupId]: willShow
      }
      if (willShow) {
        this.startMiniSummaryTyping(groupId)
      } else {
        this.clearMiniSummaryTypingTimers(groupId)
        delete this.miniSummaryDisplayTextMap[groupId]
      }
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
        this.error = '?????' + (err.response?.data?.detail || err.message)
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
        this.error = '???????' + err.message
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

        this.miniCharts[group.group_id].setOption({
          animation: false,
          grid: {
            show: true,
            borderColor: '#cbd5e1',
            borderWidth: 1,
            left: 24,
            right: 26,
            top: 22,
            bottom: 12,
            containLabel: true
          },
          xAxis: {
            type: 'category',
            z: 5,
            data: numbers,
            boundaryGap: true,
            name: '\u70b9\u6570\u548c',
            nameLocation: 'end',
            nameGap: 2,
            nameTextStyle: { color: '#334155', fontSize: 8, fontWeight: 600 },
            axisLabel: {
              show: true,
              fontSize: 9,
              fontWeight: 700,
              color: '#334155',
              interval: 0,
              hideOverlap: false,
              lineHeight: 12,
              formatter(value) {
              return `${value}`
            }
            },
            axisTick: { show: false },
            axisLine: { show: true, lineStyle: { color: '#64748b', width: 1 } },
            splitLine: { show: true, lineStyle: { color: '#cbd5e1', width: 2 } }
          },
          yAxis: {
            type: 'value',
            z: 5,
            min: 0,
            max: axisMax,
            name: '娆℃暟',
            nameLocation: 'end',
            nameGap: 8,
            nameTextStyle: { color: '#334155', fontSize: 8, fontWeight: 600 },
            interval: 1,
            splitLine: { show: true, lineStyle: { color: '#cbd5e1', width: 2 } },
            axisLabel: { show: true, fontSize: 9, color: '#334155' },
            axisTick: { show: false },
            axisLine: { show: true, lineStyle: { color: '#94a3b8', width: 1 } }
          },
          series: [
            {
              type: 'bar',
              z: 1,
              barWidth: '100%',
              data: numbers.map((n, idx) => ({
                value: counts[idx],
                itemStyle: {
                  color: [2, 3, 4, 10, 11, 12].includes(n) ? '#FFE600' : '#D92121'
                }
              })),
              itemStyle: {
                borderWidth: 0,
              },
              label: {
                show: true,
                position: 'top',
                distance: -2,
                fontSize: 14,
                color: '#334155'
              }
            }
          ]
        })
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

      this.classChart.setOption({
        tooltip: { trigger: 'axis' },
        grid: {
          show: true,
          borderColor: '#cbd5e1',
          borderWidth: 1,
          left: 24,
          right: 50,
          top: 30,
          bottom: 24,
          containLabel: true
        },
        xAxis: {
          type: 'category',
          z: 5,
          data: numbers,
          boundaryGap: true,
          name: '\u70b9\u6570\u548c',
          nameLocation: 'end',
          nameGap: 8,
          nameTextStyle: { color: '#334155', fontSize: 12, fontWeight: 600 },
          axisTick: { show: false },
          axisLine: { lineStyle: { color: '#64748b', width: 1 } },
          axisLabel: {
            fontSize: 12,
            fontWeight: 700,
            color: '#334155',
            interval: 0,
            hideOverlap: false,
            lineHeight: 20,
            margin: 14,
            formatter(value) {
              return `${value}`
            }
          },
          splitLine: { show: true, lineStyle: { color: '#cbd5e1', width: 2 } }
        },
        yAxis: {
          type: 'value',
          z: 5,
          min: 0,
          max: alignedAxisMax,
          name: '娆℃暟',
          nameLocation: 'end',
          nameGap: 10,
          nameTextStyle: { color: '#334155', fontSize: 12, fontWeight: 600 },
          interval: axisInterval,
          splitLine: { show: true, lineStyle: { color: '#cbd5e1', width: 1 } },
          axisLabel: { color: '#334155' },
          axisLine: { show: true, lineStyle: { color: '#94a3b8', width: 1 } },
          axisTick: { show: false }
        },
        series: [
          {
            type: 'bar',
            z: 1,
            barWidth: '100%',
            data: numbers.map((n, idx) => ({
              value: counts[idx],
              itemStyle: {
                color: [2, 3, 4, 10, 11, 12].includes(n) ? '#FFE600' : '#D92121'
              }
            })),
            itemStyle: { borderWidth: 0 },
            label: { show: true, position: 'top', distance: -2, fontSize: 18, color: '#334155' }
          }
        ]
      })
    },
    async runSimulation() {
      const targetTimes = Number(this.simulationInput)
      if (!Number.isInteger(targetTimes) || targetTimes < 1) {
        this.error = '????? 0 ?????'
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
            this.error = '????????' + (error?.message || '????')
            this.stopDiceSimulation()
          }
        })
      } catch (err) {
        this.error = '?????' + (err.response?.data?.detail || err.message)
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
          this.error = '???????' + (error?.message || '????')
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

      this.simChart.setOption({
        tooltip: { trigger: 'axis' },
        animation: true,
        animationDuration: 0,
        animationDurationUpdate: 50,
        animationEasingUpdate: 'linear',
        grid: {
          show: true,
          borderColor: '#cbd5e1',
          borderWidth: 1,
          left: 20,
          right: 54,
          top: 30,
          bottom: 24,
          containLabel: true
        },
        xAxis: {
          type: 'category',
          z: 5,
          data: numbers,
          boundaryGap: true,
          name: '\u70b9\u6570\u548c',
          nameLocation: 'end',
          nameGap: 8,
          nameTextStyle: { color: '#334155', fontSize: 12, fontWeight: 600 },
          axisTick: { show: false },
          axisLine: { lineStyle: { color: '#64748b', width: 2 } },
          axisLabel: {
            fontSize: 12,
            fontWeight: 700,
            color: '#334155',
            interval: 0,
            hideOverlap: false,
            lineHeight: 20,
            margin: 14,
            formatter(value) {
              return `${value}`
            }
          },
          splitLine: { show: true, lineStyle: { color: '#cbd5e1', width: 2 } }
        },
        yAxis: {
          type: 'value',
          z: 5,
          min: 0,
          max: axisMax,
          name: '娆℃暟',
          nameLocation: 'end',
          nameGap: 10,
          nameTextStyle: { color: '#334155', fontSize: 12, fontWeight: 600 },
          interval: axisInterval,
          splitLine: { show: true, lineStyle: { color: '#cbd5e1', width: 1 } },
          axisLabel: { color: '#334155' },
          axisLine: { show: true, lineStyle: { color: '#94a3b8', width: 2 } },
          axisTick: { show: false }
        },
        series: [
          {
            type: 'bar',
            z: 1,
            barWidth: '100%',
            animation: true,
            animationDurationUpdate: 50,
            animationEasingUpdate: 'linear',
            data: numbers.map((n, idx) => ({
              value: counts[idx],
              itemStyle: {
                color: [2, 3, 4, 10, 11, 12].includes(n) ? '#FFE600' : '#D92121'
              }
            })),
            itemStyle: { borderWidth: 0, borderRadius: [4, 4, 0, 0] },
            label: {
              show: true,
              position: 'top',
              distance: -2,
              fontSize: simLabelFontSize,
              color: '#334155',
              overflow: 'truncate',
              width: 70,
              formatter: ({ value }) => Math.round(Number(value || 0))
            }
          }
        ]
      })
    },
    onResize() {
      if (this.classChart) this.classChart.resize()
      if (this.classPieChart) this.classPieChart.resize()
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
    if (this.classPieChart) this.classPieChart.dispose()
    if (this.simChart) this.simChart.dispose()
    Object.values(this.miniCharts).forEach(chart => chart.dispose())
    this.stopTypingAudio()
    this.typingAudio = null
    this.stopDiceSimulation()
  }
}