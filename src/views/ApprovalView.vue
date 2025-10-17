<template>
  <v-container fluid class="pa-4">
    <div>
      <v-row>
        <v-col>
          <PendingApprovalList />
        </v-col>
      </v-row>
    </div>
    <div>
      <v-row>
        <v-col>
          <ApproverList />
        </v-col>
      </v-row>
    </div>
  </v-container>
</template>

<script setup lang="ts">
import PendingApprovalList from '@/components/approval/PendingApprovalList.vue'
import ApproverList from '@/components/approver/ApproverList.vue'
</script>

<style scoped>
.v-container {
  max-width: 100%;
}
</style>