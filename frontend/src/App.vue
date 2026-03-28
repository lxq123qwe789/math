<template>
  <div class="app-shell">
    <header class="topbar" v-if="isLoggedIn">
      <div class="topbar-inner">
        <div class="brand">
          <div class="brand-icon">🎲</div>
          <div>
            <h1 class="brand-title">两颗骰子掷一掷</h1>
          </div>
          <div class="brand-icon">🎲</div>
        </div>
        <div class="user-panel" v-if="currentUser">
          <div>
            <p class="user-name">{{ currentUser.username }}</p>
            <p class="user-role">{{ getRoleName(currentUser.role) }}</p>
          </div>
          <button class="logout-btn" @click="logout">退出</button>
        </div>
      </div>
    </header>

    <main class="main-container" :class="{ 'login-mode': !isLoggedIn }">
      <section v-if="!isLoggedIn" class="login-wrap">
        <article class="login-card">
          <h2 class="login-title">欢迎登录</h2>
          <p class="login-desc">请输入账号信息进入系统</p>

          <form class="login-form" @submit.prevent="handleLogin">
            <div class="field-group">
              <label class="field-label">用户名</label>
              <input
                v-model="loginForm.username"
                type="text"
                placeholder="请输入用户名"
                class="field-input"
              />
            </div>

            <div class="field-group">
              <label class="field-label">密码</label>
              <input
                v-model="loginForm.password"
                type="password"
                placeholder="请输入密码"
                class="field-input"
              />
            </div>

            <div v-if="loginError" class="login-error">{{ loginError }}</div>

            <button type="submit" :disabled="isLoading" class="login-btn">
              {{ isLoading ? '登录中...' : '登录' }}
            </button>
          </form>

          <div class="demo-info">
            <p>学生账号：1组-8组，密码：12345678</p>
          </div>
        </article>
      </section>

      <StudentPanel
        v-else-if="currentUser && currentUser.role === 'student'"
        :user="currentUser"
      />

      <TeacherPanel v-else />
    </main>
  </div>
</template>

<script>
import axios from 'axios'
import StudentPanel from './components/StudentPanel.vue'
import TeacherPanel from './components/TeacherPanel.vue'

export default {
  name: 'App',
  components: {
    StudentPanel,
    TeacherPanel
  },
  data() {
    return {
      isLoggedIn: false,
      currentUser: null,
      isLoading: false,
      loginError: '',
      loginForm: {
        username: '',
        password: ''
      }
    }
  },
  methods: {
    async handleLogin() {
      this.isLoading = true
      this.loginError = ''

      try {
        const response = await axios.post('/api/auth/login', {
          username: this.loginForm.username,
          password: this.loginForm.password
        })

        const { access_token, user_id, username, role, group_id } = response.data
        localStorage.setItem('token', access_token)
        localStorage.setItem('user', JSON.stringify({ user_id, username, role, group_id }))

        this.currentUser = { user_id, username, role, group_id }
        this.isLoggedIn = true
        this.loginForm = { username: '', password: '' }
        axios.defaults.headers.common.Authorization = `Bearer ${access_token}`
      } catch (error) {
        this.loginError = error.response?.data?.detail || '登录失败，请检查用户名和密码'
      } finally {
        this.isLoading = false
      }
    },
    logout() {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      this.isLoggedIn = false
      this.currentUser = null
      delete axios.defaults.headers.common.Authorization
    },
    getRoleName(role) {
      return role === 'admin' ? '教师' : '学生'
    }
  },
  mounted() {
    const token = localStorage.getItem('token')
    const user = localStorage.getItem('user')

    if (token && user) {
      this.currentUser = JSON.parse(user)
      this.isLoggedIn = true
      axios.defaults.headers.common.Authorization = `Bearer ${token}`
    }
  }
}
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  background: #f8fafc;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid #e2e8f0;
}

.topbar-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 14px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: #eef2ff;
}

.brand-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.2;
  color: #0f172a;
}

.brand-subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  color: #64748b;
}

.user-panel {
  display: flex;
  align-items: center;
  gap: 14px;
}

.user-name {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  text-align: right;
}

.user-role {
  margin: 0;
  font-size: 12px;
  color: #64748b;
  text-align: right;
}

.logout-btn {
  border: none;
  background: #ef4444;
  color: #fff;
  border-radius: 10px;
  padding: 9px 14px;
  font-weight: 600;
  cursor: pointer;
}

.main-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 20px 40px;
}

.main-container.login-mode {
  max-width: none;
  min-height: 100vh;
  padding: 0;
}

.login-wrap {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.login-card {
  width: 100%;
  max-width: 420px;
  background: #ffffff;
  border-radius: 18px;
  box-shadow: 0 14px 40px rgba(15, 23, 42, 0.12);
  border: 1px solid #e2e8f0;
  padding: 28px;
}

.login-title {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #0f172a;
  text-align: center;
}

.login-desc {
  margin: 10px 0 22px;
  text-align: center;
  color: #64748b;
  font-size: 14px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.field-input {
  width: 100%;
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 12px;
  padding: 11px 12px;
  font-size: 14px;
  color: #0f172a;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.field-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18);
}

.login-error {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 13px;
}

.login-btn {
  width: 100%;
  border: none;
  border-radius: 12px;
  background: #3b82f6;
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  padding: 12px 14px;
  cursor: pointer;
  transition: transform 0.08s ease, box-shadow 0.15s ease, background-color 0.15s ease;
}

.login-btn:hover {
  background: #2563eb;
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.25);
}

.login-btn:active {
  transform: scale(0.98);
}

.login-btn:disabled {
  background: #93c5fd;
  cursor: not-allowed;
  box-shadow: none;
}

.demo-info {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid #e2e8f0;
}

.demo-info p {
  margin: 4px 0;
  text-align: center;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.6;
}
</style>
