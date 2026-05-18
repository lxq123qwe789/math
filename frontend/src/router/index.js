import { createRouter, createWebHistory } from 'vue-router'
import TeacherView from '../views/TeacherView.vue'
import StudentView from '../views/StudentView.vue'

const routes = [
  {
    path: '/teacher',
    name: 'TeacherView',
    component: TeacherView
  },
  {
    path: '/student',
    name: 'StudentView',
    component: StudentView
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
