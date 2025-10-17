<template>
  <v-card class="category-summary">
    <v-card-title class="d-flex align-center">
      <v-icon class="mr-2" color="primary">mdi-chart-pie</v-icon>
      {{ $t('approval.category.summary') }}
      <v-spacer />
      <v-chip
        v-if="totalHours"
        color="primary"
        variant="flat"
        size="small"
      >
        {{ $t('approval.category.total') }}: {{ totalHours.toFixed(1) }}h
      </v-chip>
    </v-card-title>
    
    <v-divider />
    
    <v-card-text v-if="!categoryData.length">
      <v-alert type="info" variant="tonal" density="compact">
        {{ $t('approval.category.noData') }}
      </v-alert>
    </v-card-text>
    
    <v-card-text v-else>
      <!-- Category breakdown with progress bars -->
      <div class="category-breakdown">
        <div
          v-for="category in categoryData"
          :key="category.name"
          class="category-item mb-3"
        >
          <div class="d-flex justify-space-between align-center mb-1">
            <div class="d-flex align-center">
              <v-chip
                :color="category.color"
                size="x-small"
                variant="flat"
                class="mr-2"
              >
                {{ category.name }}
              </v-chip>
            </div>
            <div class="text-body-2 font-weight-medium">
              {{ category.hours.toFixed(1) }}h ({{ category.percentage.toFixed(1) }}%)
            </div>
          </div>
          
          <v-progress-linear
            :model-value="category.percentage"
            :color="category.color"
            height="8"
            rounded
          />
        </div>
      </div>
      
      <!-- Project breakdown toggle -->
      <div v-if="projectBreakdowns && projectBreakdowns.length" class="mt-4">
        <v-expand-transition>
          <div  class="project-breakdown mt-2">
            <v-list density="compact">
              <v-list-item
                v-for="project in projectBreakdowns"
                :key="project.projectId"
                class="px-0"
              >
                <template #prepend>
                  <v-icon size="small" color="info">mdi-folder-outline</v-icon>
                </template>
                
                <v-list-item-title class="text-body-2">
                  {{ project.project.name || project.projectId }}
                </v-list-item-title>
                
                <v-list-item-subtitle>
                  <div class="d-flex flex-wrap ga-1 mt-1">
                    <v-chip
                      v-for="(hours, category) in project.categoryHours"
                      :key="category"
                      size="x-small"
                      variant="outlined"
                      color="secondary"
                    >
                      {{ category }}: {{ Number(hours).toFixed(1) }}h
                    </v-chip>
                  </div>
                </v-list-item-subtitle>
                
                <template #append>
                  <v-chip
                    size="small"
                    color="primary"
                    variant="tonal"
                  >
                    {{ Number(project.totalHours).toFixed(1) }}h
                  </v-chip>
                </template>
              </v-list-item>
            </v-list>
          </div>
        </v-expand-transition>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ProjectBreakdown } from '@/services'

// Props
interface Props {
  categoryHours: Record<string, number>
  projectBreakdowns?: ProjectBreakdown[]
  showProjectDetails?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  categoryHours: () => ({}),
  projectBreakdowns: () => [],
})

const { t: $t } = useI18n()

// Color palette for categories
const categoryColors = [
  'primary', 'secondary', 'accent', 'success', 'warning', 'error', 'info',
  'purple', 'pink', 'indigo', 'cyan', 'teal', 'green', 'lime', 'amber', 'orange'
]

// Computed properties
const totalHours = computed(() => {
  return Object.values(props.categoryHours).reduce((sum, hours) => sum + (Number(hours) || 0), 0)
})

const categoryData = computed(() => {
  const total = totalHours.value
  if (total === 0) return []
  
  return Object.entries(props.categoryHours)
    .map(([name, hours], index) => ({
      name,
      hours: Number(hours) || 0,
      percentage: ((Number(hours) || 0) / total) * 100,
      color: categoryColors[index % categoryColors.length]
    }))
    .sort((a, b) => b.hours - a.hours) // Sort by hours descending
})

</script>
