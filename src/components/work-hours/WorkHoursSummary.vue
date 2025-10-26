<template>
  <div>
    <v-card>
      <v-card-item>
        <!-- タブ切り替え -->
        <v-tabs v-model="activeTab">
          <v-tab value="project">Project</v-tab>
          <v-tab value="category">Category</v-tab>
        </v-tabs>

        <v-tabs-window v-model="activeTab">
          <!-- プロジェクト別工数 -->
          <v-tabs-window-item value="project" transition="none" reverse-transition="none">
            <v-skeleton-loader type="list-item@3" v-if="loadingSummary">
            </v-skeleton-loader>
            <v-list density="compact" v-else-if="!loadingSummary && hasProjectHours">
              <v-list-item
                v-for="(hours, project) in projectHours"
                :key="String(project)"
              >
                <!-- <template #prepend> -->
                  <!-- <v-icon color="primary">mdi-folder</v-icon> -->
                <!-- </template> -->

                <v-list-item-title><v-chip size="small" color="primary">{{ project }}</v-chip></v-list-item-title>

                <template #append>
                  <div class="d-flex align-center">
                    <span class="mr-2">{{ hours.toFixed(1) }} h</span>
                    <v-progress-linear
                      :model-value="(hours / totalHours) * 100"
                      color="primary"
                      height="8"
                      rounded
                      style="width: 100px"
                    ></v-progress-linear>
                  </div>
                </template>
              </v-list-item>
            </v-list>
          </v-tabs-window-item>

          <!-- カテゴリ別工数 -->
          <v-tabs-window-item value="category" transition="none" reverse-transition="none">
            <v-skeleton-loader type="list-item@3" v-if="loadingSummary">
            </v-skeleton-loader>
            <v-pie v-else-if="summary"
              :palette="['#048BA8', '#99C24D', '#F18F01']"
              :items="categoryItems" />


            <v-list density="compact" v-else-if="!loadingSummary && hasCategoryHours">
              <v-list-item
                v-for="(hours, category) in categoryHours"
                :key="String(category)"
              >
                <!-- <template #prepend>
                  <v-icon color="primary">mdi-folder</v-icon>
                </template> -->

                <v-list-item-title><v-chip size="small" color="primary">{{ category }}</v-chip></v-list-item-title>

                <template #append>
                  <div class="d-flex align-center">
                    <span class="mr-2">{{ hours.toFixed(1) }} h</span>
                    <v-progress-linear
                      :model-value="(hours / totalHours) * 100"
                      color="primary"
                      height="8"
                      rounded
                      style="width: 100px"
                    ></v-progress-linear>
                  </div>
                </template>
              </v-list-item>
            </v-list>
          </v-tabs-window-item>
        </v-tabs-window>
      </v-card-item>
      <v-card-actions class="justify-end" v-if="!loadingSummary">
        <v-card-subtitle>
        {{ summary ? `${summary.startDate} ~ ${summary.endDate}` : '期間不明' }}
        </v-card-subtitle>
      </v-card-actions>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { WorkHoursSummaryResponse } from '@/services/types'

interface Props {
  summary: WorkHoursSummaryResponse | null
  period: 'week' | 'month' | 'custom'
  loadingSummary: boolean
}

const props = defineProps<Props>()

const categoryItems = computed(() => {
  if(!props.summary) return []
  return Object.entries(props.summary.categoryHours).map(([key, value]) => ({key, value}))
})

const hasCategoryHours = computed(() => {
  return props.summary?.categoryHours && Object.keys(props.summary.categoryHours).length > 0
})

const hasProjectHours = computed(() => {
  return props.summary?.projectHours && Object.keys(props.summary.projectHours).length > 0
})

const projectHours = computed(() => props.summary?.projectHours || {})
const categoryHours = computed(() => props.summary?.categoryHours || {})
const totalHours = computed(() => props.summary?.totalHours || 0)

// Data
const activeTab = ref('project')

</script>