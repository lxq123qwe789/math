<template>
  <section class="student-page">
    <header class="page-header">
      <h2 class="page-title">点数和试验</h2>
    </header>

    <div class="layout-grid">
      <article class="panel-card control-card">
        <div class="panel-head panel-head-with-action">
          <h3>掷一掷，选一选</h3>
          <button @click="resetAllData" class="reset-btn">重置</button>
        </div>

        <div class="control-overview">
          <div class="overview-top">
            <span class="overview-title">总试验次数</span>
            <span class="overview-value" :class="{ danger: isTotalLocked }">{{ totalCount }}/20</span>
          </div>
          <div class="overview-bar">
            <div class="overview-fill" :style="{ width: `${totalProgress}%` }"></div>
          </div>
          <p class="overview-hint" :class="{ danger: isTotalLocked }">
            {{ isTotalLocked ? '总次数已到 20，当前仅可重置后继续。' : '点击“+”累计总次数，达到20次自动停止新增。' }}
          </p>
        </div>

        <div class="number-grid">
          <div
            v-for="number in [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]"
            :key="number"
            class="number-item"
            :class="{ full: isTotalLocked, 'group-a': isAGroup(number), 'group-b': !isAGroup(number) }"
          >
            <div class="number-top">
              <span class="num-value">{{ number }}</span>
              <span class="num-tag" :class="isAGroup(number) ? 'a-tag' : 'b-tag'">
                {{ isAGroup(number) ? 'A组' : 'B组' }}
              </span>
            </div>

            <div class="action-row">
              <button
                @click="decrementCount(number)"
                :disabled="getData(number)?.count === 0"
                :aria-label="`点数和 ${number} 减少一次`"
                class="minus-btn"
              >
                -
              </button>
              <button
                @click="incrementCount(number)"
                :disabled="isTotalLocked"
                :aria-label="`点数和 ${number} 增加一次`"
                class="plus-btn"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <p v-if="error" class="status-error">{{ error }}</p>
      </article>

      <article class="panel-card chart-card">
        <div class="panel-head">
          <h3>点数和统计图</h3>
        </div>
        <div ref="chartContainer" class="chart-container"></div>
      </article>
    </div>

    <div class="stats-row">
      <article class="stat-card a-card">
        <span class="stat-icon ball-icon">●</span>
        <p class="stat-line">掷到A组：{{ statistics.groupA }}次</p>
      </article>

      <article class="stat-card b-card">
        <span class="stat-icon ball-icon">●</span>
        <p class="stat-line">掷到B组：{{ statistics.groupB }}次</p>
      </article>

      <article class="stat-card winner-card" :class="winnerCardClass">
        <span class="stat-icon winner-flag">🚩</span>
        <p class="stat-line">{{ winnerTextForBadge }}</p>
      </article>
    </div>

  </section>
</template>

<script>
import * as echarts from 'echarts'
import { markRaw } from 'vue'
import axios from '../lib/http'
import { io } from 'socket.io-client'
import {
  STUDENT_GROUP_A_NUMBERS,
  buildStudentChartOption,
  buildStudentInitialChartOption
} from '../utils/charts'

export default {
  name: 'StudentView',
  props: {
    user: Object
  },
  data() {
    return {
      groupData: [],
      statistics: {
        groupA: 0,
        groupB: 0,
        winner: 'Tie'
      },
      isLoading: false,
      error: '',
      chart: null,
      resizeHandler: null,
      socket: null,
      isFetchingGroupData: false,
      groupRefreshTimer: null,
      hasPendingGroupRefresh: false,
      groupRefreshDelay: 150
    }
  },
  computed: {
    groupId() {
      if (this.user?.group_id) return this.user.group_id

      const nameToId = {
        '1组': 1,
        '2组': 2,
        '3组': 3,
        '4组': 4,
        '5组': 5,
        '6组': 6,
        '7组': 7,
        '8组': 8,
      }

      return nameToId[this.user?.username] || 1
    },
    totalCount() {
      return this.groupData.reduce((sum, item) => sum + (item.count || 0), 0)
    },
    isTotalLocked() {
      return this.totalCount >= 20
    },
    totalProgress() {
      return Math.min(100, (this.totalCount / 20) * 100)
    },
    winnerCardClass() {
      if (this.statistics.winner === 'A') return 'winner-a-card'
      if (this.statistics.winner === 'B') return 'winner-b-card'
      return 'winner-tie-card'
    },
    winnerTextForBadge() {
      if (this.statistics.winner === 'A') return 'A组获胜'
      if (this.statistics.winner === 'B') return 'B组获胜'
      return '当前平局'
    }
  },
  methods: {
    async fetchGroupData() {
      if (this.isFetchingGroupData) {
        this.hasPendingGroupRefresh = true
        return
      }

      this.isFetchingGroupData = true
      try {
        this.error = ''
        const response = await axios.get(`/api/student/group/${this.groupId}/data`)

        this.groupData = response.data.records
        this.statistics = {
          groupA: response.data.group_a_total,
          groupB: response.data.group_b_total,
          winner: response.data.winner
        }

        this.updateChart()
      } catch (err) {
        this.error = '获取数据失败：' + (err.response?.data?.detail || err.message)
      } finally {
        this.isFetchingGroupData = false
        if (this.hasPendingGroupRefresh) {
          this.hasPendingGroupRefresh = false
          this.scheduleFetchGroupData()
        }
      }
    },
    scheduleFetchGroupData() {
      this.hasPendingGroupRefresh = true
      if (this.groupRefreshTimer) return

      this.groupRefreshTimer = setTimeout(async () => {
        this.groupRefreshTimer = null
        if (!this.hasPendingGroupRefresh) return
        this.hasPendingGroupRefresh = false
        await this.fetchGroupData()
      }, this.groupRefreshDelay)
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
      })

      this.socket.on('connect_error', (err) => {
        this.error = '实时连接失败：' + err.message
      })

      this.socket.on('data_updated', (payload) => {
        const groupIds = Array.isArray(payload?.group_ids)
          ? payload.group_ids.map(id => Number(id)).filter(id => Number.isInteger(id))
          : []
        if (!groupIds.length || groupIds.includes(this.groupId)) {
          this.scheduleFetchGroupData()
        }
      })
    },

    getData(number) {
      return this.groupData.find(r => r.number === number)
    },

    isAGroup(number) {
      return STUDENT_GROUP_A_NUMBERS.includes(number)
    },

    async incrementCount(number) {
      if (this.isTotalLocked) {
        this.error = '总次数已达到20次，不能继续增加'
        return
      }

      this.isLoading = true
      try {
        await axios.post(
          '/api/student/update',
          {
            group_id: this.groupId,
            number,
            action: 'increment'
          },
          {
            params: { group_id: this.groupId, number, action: 'increment' }
          }
        )

        await this.fetchGroupData()
      } catch (err) {
        this.error = err.response?.data?.detail || '更新失败'
      } finally {
        this.isLoading = false
      }
    },

    async decrementCount(number) {
      const count = this.getData(number)?.count || 0
      if (count === 0) {
        this.error = '次数不能为负数'
        return
      }

      this.isLoading = true
      try {
        await axios.post(
          '/api/student/update',
          {
            group_id: this.groupId,
            number,
            action: 'decrement'
          },
          {
            params: { group_id: this.groupId, number, action: 'decrement' }
          }
        )

        await this.fetchGroupData()
      } catch (err) {
        this.error = err.response?.data?.detail || '更新失败'
      } finally {
        this.isLoading = false
      }
    },

    async resetAllData() {
      if (!confirm('确定要重置所有数据吗？')) return

      this.isLoading = true
      try {
        await axios.post(`/api/student/group/${this.groupId}/reset`)
        await this.fetchGroupData()
      } catch (err) {
        this.error = '重置失败：' + (err.response?.data?.detail || err.message)
      } finally {
        this.isLoading = false
      }
    },

    updateChart() {
      if (!this.chart) return

      const numbers = this.groupData.map(r => r.number)
      const counts = this.groupData.map(r => r.count)
      const maxCount = counts.length ? Math.max(...counts) : 0
      const axisMax = Math.max(8, maxCount)

      this.chart.setOption(buildStudentChartOption({ numbers, counts, axisMax }))
    },

    initChart() {
      const container = this.$refs.chartContainer
      if (!container) return

      this.chart = markRaw(echarts.init(container))
      this.chart.setOption(buildStudentInitialChartOption())

      this.resizeHandler = () => {
        if (this.chartResizeFrame) cancelAnimationFrame(this.chartResizeFrame)
        this.chartResizeFrame = requestAnimationFrame(() => {
          this.chartResizeFrame = null
          if (container.clientWidth && container.clientHeight) this.chart?.resize()
        })
      }
      this.chartResizeObserver = new ResizeObserver(this.resizeHandler)
      this.chartResizeObserver.observe(container)
      window.addEventListener('resize', this.resizeHandler)
      document.addEventListener('fullscreenchange', this.resizeHandler)
    }
  },
  mounted() {
    this.initChart()
    this.fetchGroupData()
    this.connectSocket()
  },
  beforeUnmount() {
    this.chartResizeObserver?.disconnect()
    if (this.chartResizeFrame) cancelAnimationFrame(this.chartResizeFrame)
    if (this.groupRefreshTimer) clearTimeout(this.groupRefreshTimer)
    if (this.socket) this.socket.disconnect()
    if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler)
    if (this.resizeHandler) document.removeEventListener('fullscreenchange', this.resizeHandler)
    if (this.chart) this.chart.dispose()
  }
}
</script>

<style scoped src="./student-layout.css"></style>
