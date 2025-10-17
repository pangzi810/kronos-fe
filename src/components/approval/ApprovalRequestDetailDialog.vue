<template>
  <v-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    max-width="800"
  >
    <v-card v-if="approval">
      <v-card-title>
        <v-icon start>mdi-file-document-outline</v-icon>
        {{ $t('approval.approvalDetails') }}
      </v-card-title>
      
      <v-divider />
      
      <v-card-text>
        <v-row>
          <v-col cols="6">
            <v-list density="compact">
              <v-list-item>
                <template #prepend>
                  <v-icon>mdi-account</v-icon>
                </template>
                <v-list-item-title>{{ $t('approval.applicant') }}</v-list-item-title>
                <v-list-item-subtitle>{{ approval.user.fullName }}</v-list-item-subtitle>
              </v-list-item>
              
              <v-list-item>
                <template #prepend>
                  <v-icon>mdi-calendar</v-icon>
                </template>
                <v-list-item-title>{{ $t('approval.workDate') }}</v-list-item-title>
                <v-list-item-subtitle>{{ formatDate(approval.workDate) }}</v-list-item-subtitle>
              </v-list-item>
              
              <v-list-item>
                <template #prepend>
                  <v-icon>mdi-clock-outline</v-icon>
                </template>
                <v-list-item-title>{{ $t('approval.totalHours') }}</v-list-item-title>
                <v-list-item-subtitle>{{ $t('approval.counts.hours', { hours: approval.totalHours }) }}</v-list-item-subtitle>
              </v-list-item>
              
              <v-list-item>
                <template #prepend>
                  <v-icon>mdi-check-circle</v-icon>
                </template>
                <v-list-item-title>{{ $t('approval.approvalStatus') }}</v-list-item-title>
                <v-list-item-subtitle>
                  <v-chip
                    size="small"
                    :color="getApprovalStatusColor(approval.approvalStatus)"
                    variant="flat"
                  >
                    {{ $t(`approval.status.${approval.approvalStatus.toLowerCase()}`, getApprovalStatusText(approval.approvalStatus)) }}
                  </v-chip>
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-col>
          
          <v-col cols="6">
            <div class="text-subtitle-2 mb-2">{{ $t('approval.categoryHours') }}</div>
            <div class="d-flex flex-wrap ga-2 mb-4">
              <v-chip
                v-for="(hours, category) in approval.categoryHours"
                :key="category"
                variant="tonal"
              >
                {{ category }}: {{ hours }}h
              </v-chip>
            </div>
          </v-col>
        </v-row>
        
        <v-divider class="my-3" />
        
        <div class="text-subtitle-2 mb-2">{{ $t('approval.projectBreakdown') }}</div>
        <v-expansion-panels variant="accordion">
          <v-expansion-panel
            v-for="(project, index) in approval.projectBreakdowns"
            :key="index"
          >
            <v-expansion-panel-title>
              <div class="d-flex justify-space-between align-center w-100 mr-4">
                <span>{{ project.project.name || project.projectId }}</span>
                <v-chip size="small" color="primary">
                  {{ project.totalHours }}h
                </v-chip>
              </div>
            </v-expansion-panel-title>
            
            <v-expansion-panel-text>
              <div v-if="project.description" class="mb-2">
                <strong>{{ $t('approval.description') }}:</strong> {{ project.description }}
              </div>
              <div>
                <strong>{{ $t('approval.categoryHours') }}:</strong>
                <div class="d-flex flex-wrap ga-1 mt-1">
                  <v-chip
                    v-for="(hours, category) in project.categoryHours"
                    :key="category"
                    size="x-small"
                    variant="tonal"
                  >
                    {{ category }}: {{ hours }}h
                  </v-chip>
                </div>
              </div>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
        
        <div v-if="approval.rejectionReason" class="mt-4">
          <v-alert type="error" variant="tonal" density="compact">
            <strong>{{ $t('approval.rejectionReason') }}:</strong> {{ approval.rejectionReason }}
          </v-alert>
        </div>
      </v-card-text>
      
      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="handleClose"
        >
          {{ $t('common.close') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useApproval } from '@/composables'
import type { AggregatedApproval } from '@/services'

interface Props {
  modelValue: boolean
  approval: AggregatedApproval | null
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { t: $t } = useI18n()
const { getApprovalStatusColor, getApprovalStatusText, formatDate } = useApproval()

const handleClose = () => {
  emit('close')
  emit('update:modelValue', false)
}
</script>

<style scoped>
.v-expansion-panel-title {
  min-height: 48px;
}

.v-expansion-panel-text {
  padding-top: 8px;
}
</style>