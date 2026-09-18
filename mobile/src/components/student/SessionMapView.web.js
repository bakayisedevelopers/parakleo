import React from 'react';
import { StyleSheet, View } from 'react-native';
import { TravelRaceTrack } from '../common/TravelRaceTrack';

export function SessionMapView({
  requestId,
  studentLocation,
  studentLocationName = 'Your Location',
  tutorName = 'Tutor',
  liveTracking,
  currentStatus = '',
}) {
  return (
    <View style={styles.container}>
      <TravelRaceTrack
        currentStatus={currentStatus}
        tutorLocation={liveTracking?.tutorLocation}
        destinationAddress={studentLocationName}
        tutorName={tutorName}
        liveTracking={liveTracking}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
