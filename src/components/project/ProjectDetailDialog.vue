<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    max-width="800"
  >
    <v-card v-if="project">
      <v-card-title>
        <v-icon start>mdi-folder-outline</v-icon>
        プロジェクト詳細
      </v-card-title>
      
      <v-divider />
      
      <v-card-text>
        <v-row>
          <v-col cols="12">
            <h3 class="text-h6 mb-2">{{ project.name }}</h3>
            <p class="text-body-2 text-medium-emphasis">{{ project.description || '説明なし' }}</p>
          </v-col>
        </v-row>
        
        <v-row class="mt-2">
          <v-col cols="6">
            <v-list density="compact">
              <v-list-item>
                <template #prepend>
                  <v-icon>mdi-information</v-icon>
                </template>
                <v-list-item-title>ステータス</v-list-item-title>
                <v-list-item-subtitle>
                  <v-chip
                    size="small"
                    :color="getStatusColor(project.status)"
                    variant="flat"
                  >
                    {{ getStatusText(project.status) }}
                  </v-chip>
                </v-list-item-subtitle>
              </v-list-item>
              
              <v-list-item>
                <template #prepend>
                  <v-icon>mdi-calendar-start</v-icon>
                </template>
                <v-list-item-title>開始日</v-list-item-title>
                <v-list-item-subtitle>{{ formatDate(project.startDate) }}</v-list-item-subtitle>
              </v-list-item>
              
              <v-list-item>
                <template #prepend>
                  <v-icon>mdi-calendar-end</v-icon>
                </template>
                <v-list-item-title>終了予定日</v-list-item-title>
                <v-list-item-subtitle>{{ formatDate(project.plannedEndDate) }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-col>
          
          <v-col cols="6">
            <!-- Additional project info can be added here if needed -->
             {{ project.customFields }}
          </v-col>
        </v-row>
        
      </v-card-text>
      
      <v-card-actions>
        <v-spacer />
        <v-btn
          @click="$emit('update:modelValue', false)"
        >
          閉じる
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import type { Project } from '@/services'

// Props
interface Props {
  modelValue: boolean
  project: Project | null
}

const props = defineProps<Props>()

// Emits
defineEmits<{
  'update:modelValue': [value: boolean]
}>()

// Status configuration
const statusConfig = {
  'PLANNING': {
    color: 'info',
    icon: 'mdi-pencil-ruler',
    text: '計画中'
  },
  'IN_PROGRESS': {
    color: 'primary',
    icon: 'mdi-progress-clock',
    text: '進行中'
  },
  'COMPLETED': {
    color: 'success',
    icon: 'mdi-check-circle',
    text: '完了'
  },
  'CANCELLED': {
    color: 'error',
    icon: 'mdi-cancel',
    text: 'キャンセル'
  }
} as const

// Status utilities
const getStatusColor = (status: string) => statusConfig[status as keyof typeof statusConfig]?.color || 'grey'
const _getStatusIcon = (status: string) => statusConfig[status as keyof typeof statusConfig]?.icon || 'mdi-help-circle'
const getStatusText = (status: string) => statusConfig[status as keyof typeof statusConfig]?.text || status

// Date utilities
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('ja-JP')
}
</script>