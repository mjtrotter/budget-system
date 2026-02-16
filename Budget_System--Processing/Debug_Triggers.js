function mapTriggers() {
    const triggers = ScriptApp.getProjectTriggers();
    const report = triggers.map(t => ({
        handler: t.getHandlerFunction(),
        type: t.getEventType(),
        source: t.getTriggerSource(),
        id: t.getUniqueId()
    }));

    console.log('🔌 ACTIVE TRIGGERS REPORT:');
    console.log(JSON.stringify(report, null, 2));

    const required = [
        'onAmazonFormSubmit',
        'onWarehouseFormSubmit',
        'onFieldTripFormSubmit',
        'onCurriculumFormSubmit',
        'onAdminFormSubmit'
    ];

    const present = report.map(r => r.handler);
    const missing = required.filter(r => !present.includes(r));

    if (missing.length > 0) {
        console.error('❌ MISSING TRIGGERS:', missing);
    } else {
        console.log('✅ ALL REQUIRED FORM TRIGGERS ARE ACTIVE');
    }
}
