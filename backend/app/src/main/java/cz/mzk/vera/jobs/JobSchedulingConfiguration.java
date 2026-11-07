package cz.mzk.vera.jobs;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

// B5. Scheduling is enabled for the application; the test profile disables the worker bean by property.
@Configuration
@EnableScheduling
public class JobSchedulingConfiguration { }
