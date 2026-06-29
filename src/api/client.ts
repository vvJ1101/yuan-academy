import axios, { AxiosError } from 'axios'
import { message } from 'antd'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || ''

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.response.use(
  (response) => response.data,
  (error: AxiosError<{ message?: string }>) => {
    const msg = error.response?.data?.message || error.message || '请求失败'
    message.error(msg)
    return Promise.reject(error)
  }
)

export default client
